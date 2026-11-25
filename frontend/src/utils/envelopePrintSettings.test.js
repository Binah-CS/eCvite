import {
  SAVED_ENVELOPE_SETTINGS_KEY,
  loadInitialEnvelopeSettings,
  loadSavedSenders,
  saveEnvelopeSettingsForReturn,
  saveSenders,
  toStoredEnvelopeSettings,
} from './envelopePrintSettings';
import { createDefaultEnvelopeSettings, createEmptySender } from './envelopeFormats';

const login = (phone) => sessionStorage.setItem('user', JSON.stringify({ phone }));
const sender = { ...createEmptySender(), name: 'כהן', street: 'הרצל', city: 'ירושלים', zip: '9100001' };
const chosen = { ...createDefaultEnvelopeSettings(), sizeId: 'c6', printSender: true, senderPlacement: 'openFlap', flapDepthMm: 33, flapShape: 'triangular' };
const corner = { ...createDefaultEnvelopeSettings(), printSender: true, senderPlacement: 'frontCorner', cornerSide: 'left' };

describe('saved senders', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    jest.restoreAllMocks();
    login('0501111111');
  });

  test('nothing saved - one empty sender', () => {
    expect(loadSavedSenders()).toEqual([createEmptySender()]);
  });

  test('saved senders come back', () => {
    saveSenders([sender, sender]);
    expect(loadSavedSenders()).toEqual([sender, sender]);
  });

  test('each user has her own senders', () => {
    saveSenders([sender]);
    login('0502222222');
    expect(loadSavedSenders()).toEqual([createEmptySender()]);
  });

  test('a corrupt value falls back to an empty sender', () => {
    localStorage.setItem('envelopeSenders-0501111111', '{not json');
    expect(loadSavedSenders()).toEqual([createEmptySender()]);
  });

  test('malformed fields are dropped, valid ones are kept', () => {
    localStorage.setItem('envelopeSenders-0501111111', JSON.stringify([{ name: 5, city: 'חיפה', evil: 'x' }]));
    expect(loadSavedSenders()).toEqual([{ ...createEmptySender(), city: 'חיפה' }]);
  });

  test('no more than the maximum number of senders is loaded', () => {
    saveSenders([sender, sender, sender]);
    expect(loadSavedSenders()).toHaveLength(2);
  });
});

describe('initial envelope settings', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    jest.restoreAllMocks();
    login('0501111111');
  });

  test('a new entry starts from the defaults, with the saved senders', () => {
    saveSenders([sender]);
    expect(loadInitialEnvelopeSettings()).toEqual({ ...createDefaultEnvelopeSettings(), senders: [sender] });
  });

  test('printing a sender is off by default even when senders are saved', () => {
    saveSenders([sender]);
    expect(loadInitialEnvelopeSettings()).toMatchObject({ printSender: false, senderPlacement: 'openFlap', cornerSide: 'auto' });
  });

  test('the settings kept for the return are ignored on a new entry', () => {
    saveEnvelopeSettingsForReturn(chosen);
    expect(loadInitialEnvelopeSettings()).toMatchObject({ sizeId: 'a7', printSender: false, flapDepthMm: 40 });
  });

  test('the corner placement and side come back from the preview and reset on a new entry', () => {
    saveSenders([sender]);
    saveEnvelopeSettingsForReturn(corner);
    expect(loadInitialEnvelopeSettings({ returning: true })).toEqual({ ...corner, senders: [sender] });
    expect(loadInitialEnvelopeSettings()).toMatchObject({ printSender: false, senderPlacement: 'openFlap', cornerSide: 'auto' });
  });

  test('the placement is kept for the return also while printing a sender is off', () => {
    saveEnvelopeSettingsForReturn({ ...corner, printSender: false });
    expect(loadInitialEnvelopeSettings({ returning: true })).toMatchObject({
      printSender: false, senderPlacement: 'frontCorner', cornerSide: 'left',
    });
  });

  test('returning from the preview restores the chosen settings', () => {
    saveSenders([sender]);
    saveEnvelopeSettingsForReturn(chosen);
    expect(loadInitialEnvelopeSettings({ returning: true })).toEqual({ ...chosen, senders: [sender] });
  });

  test('the senders are not stored with the settings kept for the return', () => {
    saveEnvelopeSettingsForReturn({ ...chosen, senders: [sender] });
    expect(JSON.parse(sessionStorage.getItem(SAVED_ENVELOPE_SETTINGS_KEY)).senders).toBeUndefined();
  });

  test('nothing is written to localStorage except the senders', () => {
    saveEnvelopeSettingsForReturn(chosen);
    expect(localStorage.length).toBe(0);
  });

  test('unknown or corrupt returned values fall back to the defaults', () => {
    sessionStorage.setItem(SAVED_ENVELOPE_SETTINGS_KEY, JSON.stringify({
      sizeId: 'b5', printSender: 'yes', senderPlacement: 'constructor', cornerSide: 'top', flapShape: 'round',
    }));
    expect(loadInitialEnvelopeSettings({ returning: true })).toMatchObject({
      sizeId: 'a7', printSender: false, senderPlacement: 'openFlap', cornerSide: 'auto', flapShape: 'straight',
    });
    sessionStorage.setItem(SAVED_ENVELOPE_SETTINGS_KEY, '{not json');
    expect(loadInitialEnvelopeSettings({ returning: true }).sizeId).toBe('a7');
  });

  test('a new entry starts from the settings saved for the user on the server', () => {
    saveSenders([sender]);
    expect(loadInitialEnvelopeSettings({ saved: toStoredEnvelopeSettings(chosen) }))
      .toEqual({ ...chosen, senders: [sender] });
  });

  test('returning from the preview wins over the settings saved on the server', () => {
    saveEnvelopeSettingsForReturn(corner);
    expect(loadInitialEnvelopeSettings({ returning: true, saved: toStoredEnvelopeSettings(chosen) }))
      .toMatchObject({ senderPlacement: 'frontCorner', cornerSide: 'left' });
  });

  test('missing, null or invalid saved settings fall back to the defaults', () => {
    [undefined, null, 'x', { sizeId: 'b5', flapShape: 'round' }].forEach((saved) => {
      expect(loadInitialEnvelopeSettings({ saved })).toMatchObject({ sizeId: 'a7', flapShape: 'straight', printSender: false });
    });
  });

  test('the stored settings never include the senders', () => {
    const stored = toStoredEnvelopeSettings({ ...chosen, senders: [sender] });
    expect(stored.senders).toBeUndefined();
    expect(stored.senderTypography).toBeUndefined();
    expect(stored.sizeId).toBe(chosen.sizeId);
  });

  test('blocked storage does not throw', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => saveSenders([sender])).not.toThrow();
    expect(() => saveEnvelopeSettingsForReturn(chosen)).not.toThrow();
    expect(loadInitialEnvelopeSettings({ returning: true })).toEqual(createDefaultEnvelopeSettings());
  });
});
