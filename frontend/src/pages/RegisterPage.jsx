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
    Snackbar,
    Alert,
} from "@mui/material";
import api from "../services/api";
import { refreshExcelColumns } from '../services/excelColumnsCache';
import { GMAIL_REGEX, PHONE_REGEX } from '../utils/validation';
import { EVENT_TYPES } from '../utils/accountDetails';
export default function RegisterPage() {

    const navigate = useNavigate();
    const location = useLocation();

    const [emailError, setEmailError] = useState(false);
    const [phoneError, setPhoneError] = useState(false);
    const [agreeTerms, setAgreeTerms] = useState(false);
    const [termsError, setTermsError] = useState("");
    const [submitError, setSubmitError] = useState(false);
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
            setEmailError(value !== "" && !GMAIL_REGEX.test(value));
        }
        if (name === "phone") {
            setPhoneError(value !== "" && !PHONE_REGEX.test(value));
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();

        if (!PHONE_REGEX.test(user.phone)) {
            setPhoneError(true);
            return;
        }
        if (!agreeTerms) {
            setTermsError("יש לאשר את תנאי השירות לפני ההרשמה");
            return;
        }

        setTermsError("");

        if (!GMAIL_REGEX.test(user.email)) {
            setEmailError(true);
            return;
        }

        try {
            const response = await api.register(user);
            sessionStorage.setItem('user', JSON.stringify(response.data));
            await refreshExcelColumns();
            navigate("/");
        } catch (err) {
            setSubmitError(true);
        }
    };


    return (
        <>
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
                        {EVENT_TYPES.map((type) => (
                            <MenuItem key={type} value={type}>{type}</MenuItem>
                        ))}
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
        <Snackbar
            open={submitError}
            autoHideDuration={6000}
            onClose={() => setSubmitError(false)}
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
            <Alert severity="error" variant="filled" onClose={() => setSubmitError(false)}>
                ההרשמה נכשלה. נסי שוב.
            </Alert>
        </Snackbar>
        </>
    );
}
