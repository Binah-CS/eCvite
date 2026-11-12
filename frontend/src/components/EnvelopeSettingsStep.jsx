// src/components/EnvelopeSettingsStep.jsx
// החלק של המעטפה בחלון ההגדרות: גודל, הדפסת שולח, לשונית ופרטי שולח. הגדרות הכתב
// והפנייה נשארות ב-PrintModal ומשותפות למדבקות. הרכיב לא שומר state משלו.
import { Box, Button, Checkbox, FormControl, FormControlLabel, InputLabel, MenuItem, Radio, RadioGroup, Select, Stack, TextField, Typography } from '@mui/material';
import { MODAL_TEXTS } from '../pages/HardCodePage';
import {
  CUSTOM_ENVELOPE_ID,
  ENVELOPE_SIZES,
  createEmptySender,
  getCustomSizeError,
  getDefaultFlapDepth,
  getSenderMode,
  isSenderComplete,
  isValidFlapDepth,
  resolveEnvelopeDimensions,
} from '../utils/envelopeFormats';
import { SENDER_MODES } from '../utils/envelopeLayout';

const numberFromInput = (value) => (value === '' ? '' : Number(value));

function SenderFields({ sender, index, canRemove, onChange, onRemove }) {
  const field = (name, label, inputProps) => (
    <TextField
      fullWidth
      size="small"
      label={label}
      value={sender[name]}
      inputProps={inputProps}
      onChange={(event) => onChange({ ...sender, [name]: event.target.value })}
    />
  );

  return (
    <Stack spacing={1}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="body2" fontWeight={600}>{MODAL_TEXTS.ENVELOPE_SENDER_TITLE(index)}</Typography>
        {canRemove && <Button size="small" color="inherit" onClick={onRemove}>{MODAL_TEXTS.ENVELOPE_REMOVE_SENDER}</Button>}
      </Stack>
      {field('name', MODAL_TEXTS.ENVELOPE_SENDER_NAME)}
      <Stack direction="row" spacing={1}>
        {field('street', MODAL_TEXTS.ENVELOPE_SENDER_STREET)}
        <Box sx={{ width: 110, flexShrink: 0 }}>{field('houseNo', MODAL_TEXTS.ENVELOPE_SENDER_HOUSE_NO)}</Box>
      </Stack>
      <Stack direction="row" spacing={1}>
        {field('city', MODAL_TEXTS.ENVELOPE_SENDER_CITY)}
        <Box sx={{ width: 130, flexShrink: 0 }}>{field('zip', MODAL_TEXTS.ENVELOPE_SENDER_ZIP)}</Box>
      </Stack>
      {field('country', MODAL_TEXTS.ENVELOPE_SENDER_COUNTRY)}
      {!isSenderComplete(sender) && (
        <Typography variant="caption" color="error">{MODAL_TEXTS.ENVELOPE_SENDER_INCOMPLETE}</Typography>
      )}
    </Stack>
  );
}

export default function EnvelopeSettingsStep({ settings, onChange }) {
  const update = (patch) => onChange({ ...settings, ...patch });
  const dimensions = resolveEnvelopeDimensions(settings);
  const senderMode = getSenderMode(settings);
  const { maxSenders } = SENDER_MODES[senderMode];
  // שולחים מעבר למה שהמצב מדפיס לא מוצגים, אבל גם לא נמחקים - הם חוזרים במעבר ללשונית
  const visibleSenders = settings.senders.slice(0, maxSenders);
  const isCustom = settings.sizeId === CUSTOM_ENVELOPE_ID;
  // הסיבה המדויקת מוצגת מתחת לשדות. בכל סיבה resolveEnvelopeDimensions מחזיר null, ולכן
  // התצוגה והכפתורים נחסמים בלי בדיקה נוספת כאן
  const sizeError = isCustom ? getCustomSizeError(settings.customSize) : null;

  const updateCustomSize = (field, value) => update({
    customSize: { ...settings.customSize, [field]: numberFromInput(value) },
  });
  const updateSender = (index, sender) => update({
    senders: settings.senders.map((current, i) => (i === index ? sender : current)),
  });

  return (
    <>
      <FormControl fullWidth>
        <InputLabel id="envelope-size-label">{MODAL_TEXTS.ENVELOPE_SIZE_INPUT_LABEL}</InputLabel>
        <Select
          labelId="envelope-size-label"
          value={settings.sizeId}
          label={MODAL_TEXTS.ENVELOPE_SIZE_INPUT_LABEL}
          onChange={(event) => update({
            sizeId: event.target.value,
            flapDepthMm: getDefaultFlapDepth(event.target.value),
          })}
        >
          {ENVELOPE_SIZES.map((size) => <MenuItem key={size.id} value={size.id}>{size.label}</MenuItem>)}
          <MenuItem value={CUSTOM_ENVELOPE_ID}>{MODAL_TEXTS.ENVELOPE_SIZE_CUSTOM}</MenuItem>
        </Select>
      </FormControl>

      {isCustom && (
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">{MODAL_TEXTS.ENVELOPE_MM_NOTE}</Typography>
          {[
            ['widthMm', MODAL_TEXTS.ENVELOPE_WIDTH],
            ['heightMm', MODAL_TEXTS.ENVELOPE_HEIGHT],
          ].map(([field, label]) => (
            <TextField
              key={field}
              size="small"
              type="number"
              label={label}
              inputProps={{ min: 0, step: 0.1 }}
              value={settings.customSize[field]}
              onChange={(event) => updateCustomSize(field, event.target.value)}
            />
          ))}
          {sizeError && (
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="caption" color="error">{MODAL_TEXTS.ENVELOPE_SIZE_ERRORS[sizeError]}</Typography>
              {sizeError === 'swapped' && (
                <Button
                  size="small"
                  onClick={() => update({
                    customSize: { ...settings.customSize, widthMm: settings.customSize.heightMm, heightMm: settings.customSize.widthMm },
                  })}
                >
                  {MODAL_TEXTS.ENVELOPE_SWAP_SIZE}
                </Button>
              )}
            </Stack>
          )}
        </Stack>
      )}

      <FormControlLabel
        control={(
          <Checkbox
            checked={settings.printSender}
            onChange={(event) => update({ printSender: event.target.checked })}
          />
        )}
        label={MODAL_TEXTS.ENVELOPE_PRINT_SENDER}
      />

      {settings.printSender && (
        <Stack spacing={2}>
          <Box>
            <Typography variant="body2" color="text.secondary">{MODAL_TEXTS.ENVELOPE_SENDER_PLACEMENT}</Typography>
            <RadioGroup value={senderMode} onChange={(event) => update({ senderPlacement: event.target.value })}>
              <FormControlLabel value="openFlap" control={<Radio size="small" />} label={MODAL_TEXTS.ENVELOPE_PLACEMENT_FLAP} />
              <FormControlLabel value="frontCorner" control={<Radio size="small" />} label={MODAL_TEXTS.ENVELOPE_PLACEMENT_CORNER} />
            </RadioGroup>
          </Box>

          {senderMode === 'frontCorner' && (
            <Box>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>{MODAL_TEXTS.ENVELOPE_CORNER_SIDE}</Typography>
                <RadioGroup row value={settings.cornerSide} onChange={(event) => update({ cornerSide: event.target.value })}>
                  <FormControlLabel value="auto" control={<Radio size="small" />} label={MODAL_TEXTS.ENVELOPE_SIDE_AUTO} />
                  <FormControlLabel value="right" control={<Radio size="small" />} label={MODAL_TEXTS.ENVELOPE_SIDE_RIGHT} />
                  <FormControlLabel value="left" control={<Radio size="small" />} label={MODAL_TEXTS.ENVELOPE_SIDE_LEFT} sx={{ mr: 0 }} />
                </RadioGroup>
              </Stack>
              {settings.cornerSide === 'auto' && (
                <Typography variant="caption" color="text.secondary">{MODAL_TEXTS.ENVELOPE_SIDE_AUTO_NOTE}</Typography>
              )}
            </Box>
          )}

          {senderMode === 'openFlap' && (
            <>
              <TextField
                size="small"
                type="number"
                label={MODAL_TEXTS.ENVELOPE_FLAP_DEPTH}
                inputProps={{ min: 0, step: 1 }}
                value={settings.flapDepthMm}
                error={Boolean(dimensions) && !isValidFlapDepth(settings.flapDepthMm, dimensions.heightMm)}
                helperText={dimensions && !isValidFlapDepth(settings.flapDepthMm, dimensions.heightMm)
                  ? MODAL_TEXTS.ENVELOPE_FLAP_DEPTH_INVALID
                  : undefined}
                onChange={(event) => update({ flapDepthMm: numberFromInput(event.target.value) })}
              />

              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>{MODAL_TEXTS.ENVELOPE_FLAP_SHAPE}</Typography>
                <RadioGroup row value={settings.flapShape} onChange={(event) => update({ flapShape: event.target.value })}>
                  <FormControlLabel value="straight" control={<Radio size="small" />} label={MODAL_TEXTS.ENVELOPE_FLAP_STRAIGHT} />
                  <FormControlLabel value="triangular" control={<Radio size="small" />} label={MODAL_TEXTS.ENVELOPE_FLAP_TRIANGULAR} sx={{ mr: 0 }} />
                </RadioGroup>
              </Stack>
            </>
          )}

          {visibleSenders.map((sender, index) => (
            <SenderFields
              key={index}
              sender={sender}
              index={index}
              canRemove={visibleSenders.length > 1}
              onChange={(next) => updateSender(index, next)}
              onRemove={() => update({ senders: settings.senders.filter((_, i) => i !== index) })}
            />
          ))}

          {settings.senders.length < maxSenders && (
            <Button size="small" onClick={() => update({ senders: [...settings.senders, createEmptySender()] })}>
              {MODAL_TEXTS.ENVELOPE_ADD_SENDER}
            </Button>
          )}
        </Stack>
      )}
    </>
  );
}
