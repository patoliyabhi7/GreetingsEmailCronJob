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

exports.handler = schedule('21 11 * * *', async (event, context) => {
    try {
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
        const mailLogSheetId = "1Hmz50dmt7OXGeMpJphrZbX63FuER4wSuVkkyz3qohDY";

        // Function to log email sending
        async function logEmailSent(category, date, email, festivalName = '') {
            await googleSheets.spreadsheets.values.append({
                auth,
                spreadsheetId: mailLogSheetId,
                range: "Sheet1!A:E",
                valueInputOption: 'RAW',
                resource: {
                    values: [[
                        `id-${Date.now()}`, // unique id
                        `${category}-${festivalName}`, // include festival name in the category
                        date,
                        email,
                        "yes"
                    ]]
                }
            });
        }

        async function emailAlreadySent(email, category, date, festivalName = '') {
            const getMailLogs = await googleSheets.spreadsheets.values.get({
                auth,
                spreadsheetId: mailLogSheetId,
                range: "Sheet1!A:E",
            });
            const mailLogs = getMailLogs.data.values || [];
            return mailLogs.some(
                log => log[1] === `${category}-${festivalName}` && log[2] === date && log[3] === email && log[4] === "yes"
            );
        }

        // Fetch existing mail logs
        const getMailLogs = await googleSheets.spreadsheets.values.get({
            auth,
            spreadsheetId: mailLogSheetId,
            range: "Sheet1",
        });

        const mailLogs = getMailLogs.data.values || [];

        // Birthday wish using Google Sheets
        const getRows = await googleSheets.spreadsheets.values.get({
            auth,
            spreadsheetId,
            range: "Sheet1",
        });

        const rows = getRows.data.values;

        const emailChunks = (emails, chunkSize) => {
            const chunks = [];
            for (let i = 0; i < emails.length; i += chunkSize) {
                chunks.push(emails.slice(i, i + chunkSize));
            }
            return chunks;
        };

        const sendEmailsInChunks = async (rows, category) => {
            const chunks = emailChunks(rows, 5); // Adjust chunk size as needed

            for (const chunk of chunks) {
                const emailPromises = chunk.map(async (row) => {
                    const userEmail = row[2];
                    const userFname = row[1].split(' ')[0];
                    let categoryKey = '';

                    if (category === 'bday' && row[3].slice(5) === now) {
                        categoryKey = 'bday';
                    } else if (category === 'workanni' && row[4].slice(5) === now) {
                        categoryKey = 'workanni';
                    } else {
                        return; // Skip non-matching rows
                    }

                    if (userEmail && !await emailAlreadySent(userEmail, categoryKey, today)) {
                        const subject = categoryKey === 'bday' ? `Happy Birthday, ${userFname}!` : `Happy Work Anniversary, ${userFname}!`;
                        const message = categoryKey === 'bday'
                            ? `Dear ${row[1]},\n\nWishing you a very happy birthday! 🎉...\n\nBest wishes,\nTeam Movya Infotech`
                            : `Dear ${row[1]},\n\nCongratulations on your work anniversary! 🎉...\n\nBest wishes,\nTeam Movya Infotech`;

                        try {
                            await sendEmailWithRetry({
                                email: userEmail,
                                subject,
                                message,
                            });
                            await logEmailSent(categoryKey, today, userEmail);
                            console.log(`${categoryKey} email sent to ${userEmail}`);
                        } catch (error) {
                            console.error(`Error sending ${categoryKey} email to ${userEmail}: ${error.message}`);
                        }
                    }
                });

                await Promise.all(emailPromises);
            }
        };

        // Send Birthday Emails
        await sendEmailsInChunks(rows, 'bday');

        // Send Anniversary Emails
        await sendEmailsInChunks(rows, 'workanni');


        const sendFesEmailsInChunks = async (rows, category, festivalName = '') => {
            const chunks = emailChunks(rows, 5); // Adjust chunk size as needed

            for (const chunk of chunks) {
                const emailPromises = chunk.map(async (row) => {
                    const userEmail = row[2];
                    const userFname = row[1].split(' ')[0];
                    let categoryKey = '';

                    if (category === 'bday' && row[3].slice(5) === now) {
                        categoryKey = 'bday';
                    } else if (category === 'workanni' && row[4].slice(5) === now) {
                        categoryKey = 'workanni';
                    } else if (category === 'festival') {
                        categoryKey = 'festival';
                    } else {
                        return; // Skip non-matching rows
                    }

                    if (userEmail && !await emailAlreadySent(userEmail, categoryKey, today, festivalName)) {
                        const subject = categoryKey === 'bday' ? `Happy Birthday, ${userFname}!` :
                            categoryKey === 'workanni' ? `Happy Work Anniversary, ${userFname}!` :
                                `Happy ${festivalName}, ${userFname}!`;

                        const message = categoryKey === 'bday'
                            ? `Dear ${row[1]},\n\nWishing you a very happy birthday! 🎉...\n\nBest wishes,\nTeam Movya Infotech`
                            : categoryKey === 'workanni'
                                ? `Dear ${row[1]},\n\nCongratulations on your work anniversary! 🎉...\n\nBest wishes,\nTeam Movya Infotech`
                                : `Dear ${row[1]},\n\nWishing you and your family a joyous ${festivalName}! 🎉...\n\nBest wishes,\nTeam Movya Infotech`;

                        try {
                            await sendEmailWithRetry({
                                email: userEmail,
                                subject,
                                message,
                            });
                            await logEmailSent(categoryKey, today, userEmail, festivalName);
                            console.log(`${categoryKey} ${festivalName} email sent to ${userEmail}`);
                        } catch (error) {
                            console.error(`Error sending ${categoryKey} email to ${userEmail}: ${error.message}`);
                        }
                    }
                });

                await Promise.all(emailPromises);
            }
        };

        // Fetch festival data and send festival emails
        const getFesRows = await googleSheets.spreadsheets.values.get({
            auth,
            spreadsheetId: festivalSheetId,
            range: "Sheet1",
        });

        const festivals = getFesRows.data.values.filter(row => row[1] === today);
        // console.log(festivals);

        for (const festival of festivals) {
            const festivalName = festival[0];
            await sendFesEmailsInChunks(rows.slice(1), 'festival', festivalName);
        }
        console.log("All emails sent")
    } catch (error) {
        console.log("Error in cron job:", error);
    }
});
