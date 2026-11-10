// src/components/EnvelopeSettingsStep.jsx
// החלק של המעטפה בחלון ההגדרות: גודל, הדפסת שולח, לשונית ופרטי שולח. הגדרות הכתב
// והפנייה נשארות ב-PrintModal ומשותפות למדבקות. הרכיב לא שומר state משלו.
import { Box, Button, Checkbox, FormControl, FormControlLabel, InputLabel, MenuItem, Radio, RadioGroup, Select, Stack, TextField, Typography } from '@mui/material';
import { MODAL_TEXTS } from '../pages/HardCodePage';
import {
  CUSTOM_ENVELOPE_ID,
  ENVELOPE_SIZES,
  MAX_SENDERS,
  createEmptySender,
  getDefaultFlapDepth,
  isSenderComplete,
  isValidFlapDepth,
  resolveEnvelopeDimensions,
} from '../utils/envelopeFormats';

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
  const printSender = settings.senderMode === 'openFlap';
  const isCustom = settings.sizeId === CUSTOM_ENVELOPE_ID;

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
          {!dimensions && <Typography variant="caption" color="error">{MODAL_TEXTS.ENVELOPE_SIZE_INVALID}</Typography>}
        </Stack>
      )}

      <FormControlLabel
        control={(
          <Checkbox
            checked={printSender}
            onChange={(event) => update({ senderMode: event.target.checked ? 'openFlap' : 'none' })}
          />
        )}
        label={MODAL_TEXTS.ENVELOPE_PRINT_SENDER}
      />

      {printSender && (
        <Stack spacing={2}>
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

          {settings.senders.map((sender, index) => (
            <SenderFields
              key={index}
              sender={sender}
              index={index}
              canRemove={settings.senders.length > 1}
              onChange={(next) => updateSender(index, next)}
              onRemove={() => update({ senders: settings.senders.filter((_, i) => i !== index) })}
            />
          ))}

          {settings.senders.length < MAX_SENDERS && (
            <Button size="small" onClick={() => update({ senders: [...settings.senders, createEmptySender()] })}>
              {MODAL_TEXTS.ENVELOPE_ADD_SENDER}
            </Button>
          )}
        </Stack>
      )}
    </>
  );
}
