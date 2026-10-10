import { Component } from 'react';
import { Box, Typography, Button } from '@mui/material';

// תופסת קריסות שקורות בתוך הרינדור של React עצמו (למשל רכיב שמנסה לקרוא שדה
// של undefined) - בלי זה, קריסה כזו הייתה מראה למשתמשת מסך לבן ריק לגמרי, בלי
// שום הסבר ובלי שום לוג - בדיוק התרחיש שתואר: "התחברות הצליחה אבל המעבר למסך
// הבא לא קרה, ואין שום שגיאת רשת שמסבירה את זה". getDerivedStateFromError/
// componentDidCatch הן ה-API היחיד ב-React לתפיסת סוג השגיאות האלה - אין מקביל
// עם hooks נכון להיום
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // אותו פורמט לוג כמו שאר המערכת (✗ + הערך המלא של השגיאה, כדי שDevTools
    // יאפשר להרחיב ולראות stack trace מדויק) - ר' api.js להשוואה
    console.error('✗ קריסה ברינדור של React', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 2, p: 3, textAlign: 'center' }}>
          <Typography variant="h6">משהו השתבש בטעינת המסך</Typography>
          <Typography variant="body2" color="text.secondary">
            פרטי השגיאה נרשמו בקונסול (F12). אפשר לנסות לרענן את הדף.
          </Typography>
          <Button variant="contained" onClick={this.handleReload}>רענון הדף</Button>
        </Box>
      );
    }
    return this.props.children;
  }
}
