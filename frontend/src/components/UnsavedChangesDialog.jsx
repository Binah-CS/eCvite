import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';

// ר' useUnsavedChangesGuard - מקבל את dialogProps שהוא מחזיר
export default function UnsavedChangesDialog({ open, onStay, onLeave }) {
  return (
    <Dialog open={open} onClose={onStay}>
      <DialogTitle>יש שינויים שלא נשמרו</DialogTitle>
      <DialogContent>
        <DialogContentText>אם תצאי עכשיו, השינויים שעשית לא יישמרו.</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onStay} variant="contained">להישאר בעמוד</Button>
        <Button onClick={onLeave} color="error">לצאת בלי לשמור</Button>
      </DialogActions>
    </Dialog>
  );
}
