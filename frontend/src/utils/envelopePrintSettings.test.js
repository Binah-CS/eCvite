import { loadEnvelopePrintSettings, saveEnvelopePrintSettings } from './envelopePrintSettings';
import { createDefaultEnvelopeSettings, createEmptySender } from './envelopeFormats';

const login = (phone) => sessionStorage.setItem('user', JSON.stringify({ phone }));
const sender = { ...createEmptySender(), name: 'כהן', street: 'הרצל', houseNo: '12', city: 'ירושלים', zip: '9100001' };

describe('envelope print settings', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    jest.restoreAllMocks();
  });

  test('nothing saved - the defaults', () => {
    login('0501111111');
    expect(loadEnvelopePrintSettings()).toEqual({ settings: createDefaultEnvelopeSettings(), textStyle: null });
  });

  test('saved settings and sender details come back', () => {
    login('0501111111');
    const settings = { ...createDefaultEnvelopeSettings(), sizeId: 'c6', senderMode: 'openFlap', flapDepthMm: 33, senders: [sender] };
    saveEnvelopePrintSettings(settings, { fontScale: 120 });
    expect(loadEnvelopePrintSettings()).toEqual({ settings, textStyle: { fontScale: 120 } });
  });

  test('each user has her own details', () => {
    login('0501111111');
    saveEnvelopePrintSettings({ ...createDefaultEnvelopeSettings(), senders: [sender] }, null);
    login('0502222222');
    expect(loadEnvelopePrintSettings().settings.senders).toEqual([createEmptySender()]);
  });

  test('a corrupt value falls back to the defaults', () => {
    login('0501111111');
    localStorage.setItem('envelopePrintSettings-0501111111', '{not json');
    expect(loadEnvelopePrintSettings().settings).toEqual(createDefaultEnvelopeSettings());
  });

  test('unknown or malformed values are replaced, valid ones are kept', () => {
    login('0501111111');
    localStorage.setItem('envelopePrintSettings-0501111111', JSON.stringify({
      settings: { sizeId: 'b5', senderMode: 'constructor', flapShape: 'round', senders: [{ name: 5, city: 'חיפה', evil: 'x' }] },
    }));
    const { settings } = loadEnvelopePrintSettings();
    expect(settings).toMatchObject({ sizeId: 'a7', senderMode: 'none', flapShape: 'straight' });
    expect(settings.senders).toEqual([{ ...createEmptySender(), city: 'חיפה' }]);
  });

  test('no more than the maximum number of senders is loaded', () => {
    login('0501111111');
    saveEnvelopePrintSettings({ ...createDefaultEnvelopeSettings(), senders: [sender, sender, sender] }, null);
    expect(loadEnvelopePrintSettings().settings.senders).toHaveLength(2);
  });

  test('blocked storage does not throw', () => {
    login('0501111111');
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => saveEnvelopePrintSettings(createDefaultEnvelopeSettings(), null)).not.toThrow();
    expect(loadEnvelopePrintSettings().settings).toEqual(createDefaultEnvelopeSettings());
  });
});
