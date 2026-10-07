import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
    Box,
    Button,
    Container,
    MenuItem,
    Paper,
    TextField,
    Typography,
} from "@mui/material";
import api from "../services/api";
import { isValidGmail, isValidIsraeliPhone } from '../utils/inputValidation';
export default function RegisterPage() {

    const navigate = useNavigate();
    const location = useLocation();

    const [emailError, setEmailError] = useState(false);
    const [phoneError, setPhoneError] = useState(false);
    const [agreeTerms, setAgreeTerms] = useState(false);
    const [termsError, setTermsError] = useState("");
    const [user, setUser] = useState({
        firstNameMan: location.state?.name || "",
        firstNameWoman: "",
        lastName: "",
        phone: location.state?.phone || "",
        email: "",
        eventType: "",
        city: "",
        street: "",
        houseNumber: "",
    });

    const handleChange = (e) => {
        const { name, value } = e.target;

        setUser({
            ...user,
            [name]: value,
        });

        if (name === "email") {
            setEmailError(value !== "" && !isValidGmail(value));
        }
        if (name === "phone") {
            setPhoneError(value !== "" && !isValidIsraeliPhone(value));
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();

        if (!isValidIsraeliPhone(user.phone)) {
            setPhoneError(true);
            return;
        }
        if (!agreeTerms) {
            setTermsError("יש לאשר את תנאי השירות לפני ההרשמה");
            return;
        }

        setTermsError("");

        if (!isValidGmail(user.email)) {
            setEmailError(true);
            return;
        }

        try {
            const response = await api.register(user);
            localStorage.setItem('user', JSON.stringify(response.data));
            navigate("/");
        } catch (err) {
            alert("ההרשמה נכשלה");
        }
    };


    return (
        <Container maxWidth="sm" sx={{ mt: 4 }}>
            <Paper sx={{ p: 4 }}>

                <Typography variant="h5" align="center" gutterBottom>
                    הרשמה למערכת
                </Typography>

                <Box
                    component="form"
                    onSubmit={handleRegister}
                    display="flex"
                    flexDirection="column"
                    gap={2}
                >

                    <TextField
                        label="שם פרטי"
                        name="firstNameWoman"
                        value={user.firstNameWoman}
                        required

                        onChange={handleChange}
                    />

                    <TextField
                        label="שם משפחה"
                        name="lastName"
                        value={user.lastName}
                        required
                        onChange={handleChange}
                    />
                    <TextField
                        label="פלאפון"
                        name="phone"
                        value={user.phone}
                        onChange={handleChange}
                        required
                        error={phoneError}
                        helperText={phoneError ? "מספר טלפון לא תקין" : ""}
                    />

                    <TextField
                        label="מייל"
                        name="email"
                        value={user.email}
                        onChange={handleChange}
                        required
                        error={emailError}
                        helperText={emailError ? "המייל שהוזן אינו תקין" : ""}
                    />
                    <TextField
                        select
                        label="עבור איזה שמחה?"
                        name="eventType"
                        value={user.eventType}
                        onChange={handleChange}
                    >
                        <MenuItem value="חתונה">חתונה</MenuItem>
                        <MenuItem value="בר מצווה">בר מצווה</MenuItem>
                        <MenuItem value="אחר">אחר</MenuItem>
                    </TextField>

                    <TextField
                        label="עיר"
                        name="city"
                        required
                        value={user.city}
                        onChange={handleChange}
                    />

                    <TextField
                        label="רחוב"
                        name="street"
                        value={user.street}
                        required
                        onChange={handleChange}
                    />

                    <TextField
                        label="מספר בית"
                        name="houseNumber"

                        value={user.houseNumber}
                        required
                        onChange={handleChange}
                    />
                    <div>
                        <input
                            type="checkbox"
                            checked={agreeTerms}
                            onChange={(e) => {
                                setAgreeTerms(e.target.checked);
                                setTermsError("");
                            }}
                        />

                        <span>
    אני מאשר/ת את{" "}
                            <a href="/terms">
      תנאי השירות
    </a>
  </span>

                        {termsError && (
                            <div style={{ color: "red", marginTop: "8px" }}>
                                {termsError}
                            </div>
                        )}
                    </div>
                    <Button
                        type="submit"
                        variant="contained"
                        size="large"
                    >
                        הרשמה
                    </Button>

                </Box>
            </Paper>
        </Container>
    );
}
