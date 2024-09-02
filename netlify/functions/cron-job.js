const { schedule } = require('@netlify/functions');
const sendEmail = require('./../../utils/email');
const { google } = require('googleapis');

exports.handler = schedule('15 5 * * *', async (event, context) => {
    try {
        console.log("Cron job started!");

        function delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        const now = new Date().toJSON().slice(5, 10);
        const today = new Date().toJSON().slice(0, 10);

        const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: "https://www.googleapis.com/auth/spreadsheets",
        });

        const client = await auth.getClient();
        const googleSheets = google.sheets({ version: "v4", auth: client });

        const spreadsheetId = "1psDuyomhJh80g4sKzlt3n2kdLip6eLAUmj8sDKocF90";
        const festivalSheetId = "1C-4dBkF91gh3Ag-MxYo7jVCQMjN831gdqcSfDrmOjzw";

        // Birthday wish using Google Sheets
        const getRows = await googleSheets.spreadsheets.values.get({
            auth,
            spreadsheetId,
            range: "Sheet1",
        });

        const bday = getRows.data.values.filter(
            async (row) => {
                if (row[3].slice(5) == now) {
                    if (row[2]) {
                        const userFname = row[1].split(' ')[0];
                        try {
                            await sendEmail({
                                email: row[2],
                                subject: `Happy Birthday, ${userFname}!`,
                                message: `Dear ${row[1]},
    
Wishing you a very happy birthday! 🎉 May your day be filled with joy, laughter, and celebration. We are grateful to have you as part of our team and hope this year brings you continued success and happiness.
            
Enjoy your special day!
    
Best wishes,
Team Movya Infotech`,
                            });
                            console.log("bday email sent", row[2]);
                            delay(2000);
                        } catch (error) {
                            console.error(`Error sending email: ${error}`);
                        }
                    }
                }
            });


        
    } catch (error) {
        console.log("Error in cron job:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal Server Error" }),
        };
    }
    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Cron job executed successfully!' }),
    };
});