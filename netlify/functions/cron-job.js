const { schedule } = require('@netlify/functions');
const { google } = require('googleapis');
const sendEmail = require('./../../utils/email');

async function sendEmailWithRetry(emailOptions, retries = 3, delayMs = 2000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await sendEmail(emailOptions);
            console.log(`Email sent to ${emailOptions.email} on attempt ${attempt}`);
            return;
        } catch (error) {
            console.error(`Attempt ${attempt} failed: ${error.message}`);
            if (attempt < retries) {
                console.log(`Retrying in ${delayMs}ms...`);
                await new Promise(res => setTimeout(res, delayMs));
            } else {
                throw new Error(`Failed to send email after ${retries} attempts`);
            }
        }
    }
}

exports.handler = schedule('19 5 * * *', async (event, context) => {
    try {
        console.log("Cron job started!");

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

        // Fetch Birthday Data
        const getRows = await googleSheets.spreadsheets.values.get({
            auth,
            spreadsheetId,
            range: "Sheet1",
        });

        // Send Birthday Emails
        const birthdayPromises = getRows.data.values.map(async (row) => {
            if (row[3].slice(5) === now && row[2]) {
                const userFname = row[1].split(' ')[0];
                return sendEmailWithRetry({
                    email: row[2],
                    subject: `Happy Birthday, ${userFname}!`,
                    message: `Dear ${row[1]},
Wishing you a very happy birthday! 🎉...`,
                });
            }
        });

        await Promise.all(birthdayPromises);

        // Fetch Anniversary Data
        const anniversaryPromises = getRows.data.values.map(async (row) => {
            if (row[4].slice(5) === now && row[2]) {
                const userFname = row[1].split(' ')[0];
                const years = new Date().getFullYear() - new Date(row[4]).getFullYear();
                const abb = years === 1 ? 'st' : years === 2 ? 'nd' : years === 3 ? 'rd' : 'th';
                return sendEmailWithRetry({
                    email: row[2],
                    subject: `Happy Work Anniversary, ${userFname}!`,
                    message: `Dear ${row[1]},
Congratulations on your ${years}${abb} work anniversary! 🎉...`,
                });
            }
        });

        await Promise.all(anniversaryPromises);

        // Fetch Festival Data
        const getFesRows = await googleSheets.spreadsheets.values.get({
            auth,
            spreadsheetId: festivalSheetId,
            range: "Sheet1",
        });

        const festivalPromises = getFesRows.data.values.map(async (row) => {
            if (row[1] === today) {
                const festival_name = row[0];
                const userRecords = getRows.data.values.slice(1);

                return Promise.all(userRecords.map(async (user) => {
                    if (user[2]) {
                        const userFname = user[1].split(' ')[0];
                        return sendEmailWithRetry({
                            email: user[2],
                            subject: `Happy ${festival_name}, ${userFname}!`,
                            message: `Dear ${user[1]},
As ${festival_name} approaches...`,
                        });
                    }
                }));
            }
        });

        await Promise.all(festivalPromises);

    } catch (error) {
        console.error("Error in cron job:", error);
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
