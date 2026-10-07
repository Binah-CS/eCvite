import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Paper,
} from '@mui/material';
import api from '../services/api';

export default function LoginPage() {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  // "מעיר" את בסיס הנתונים (Neon) כבר במסך ההתחברות - הוא "נרדם" אחרי חוסר פעילות,
  // וההתעוררות הראשונה לוקחת כמה שניות. עדיף שזה יקרה כאן, בזמן שממלאים שם/טלפון,
  // מאשר שתחכה לזה אחר כך בטעינת הטבלה עצמה. קריאה קלה שלא דורשת פרטי משתמש, בלי
  // להציג שגיאה אם היא נכשלת - זו רק "חימום", לא פעולה קריטית
  useEffect(() => {
    api.getRecipientColumns().catch(() => {});
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!name || !phone) {
      setError('יש למלא שם וטלפון');
      return;
    }

    try {
      const response = await api.login({ name, phone });

      sessionStorage.setItem('user', JSON.stringify(response.data));

      navigate('/');
    } catch (err) {
      if (err.response?.status === 404) {
        setError('אינך רשום במערכת.');
      } else {
        setError('אירעה שגיאה בהתחברות');
      }
    }
  };

  return (
      <Container maxWidth="xs" sx={{ mt: 8 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h5" align="center" gutterBottom>
            כניסה למערכת
          </Typography>

          <Box
              component="form"
              onSubmit={handleSubmit}
              sx={{ display: 'grid', gap: 2 }}
          >
            <TextField
                label="שם"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
                required
            />

            <TextField
                label="טלפון"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                fullWidth
                required
            />

            {error && (
                <Typography color="error" variant="body2">
                  {error}
                </Typography>
            )}

            <Button type="submit" variant="contained" size="large">
              כניסה
            </Button>

            {error === 'אינך רשום במערכת.' && (
                <Button
                    variant="outlined"
                    color="secondary"
                    onClick={() =>
                        navigate('/register', {
                          state: {
                            name,
                            phone,
                          },
                        })
                    }
                >
                  להרשמה
                </Button>
            )}
          </Box>
        </Paper>
      </Container>
  );
}