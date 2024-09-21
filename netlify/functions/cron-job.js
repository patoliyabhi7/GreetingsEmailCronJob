const { schedule } = require('@netlify/functions');
const { google } = require('googleapis');
const sendEmail = require('./../../utils/email');

async function sendEmailWithRetry(emailOptions, retries = 1, delayMs = 2000) {
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

exports.handler = schedule('*/2 3-8 * * *', async (event, context) => {
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
        const customEmailSheetId = '1mM37AeBsYthtfhvoMBOCVLLVkr6M5EF61cwV82-GqpY';

        // Function to log email sending
        async function logEmailSent(category, date, email, festivalName = '') {
            const now = new Date();
            const istOffset = 330; // IST is UTC+5:30
            const istTime = new Date(now.getTime() + (istOffset * 60 * 1000));

            const hours = String(istTime.getUTCHours()).padStart(2, '0');
            const minutes = String(istTime.getUTCMinutes()).padStart(2, '0');
            const seconds = String(istTime.getUTCSeconds()).padStart(2, '0');
            const currentTime = `${hours}:${minutes}:${seconds}`;

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
                        "yes",
                        currentTime
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
            const chunks = emailChunks(rows, 2); // Adjust chunk size as needed

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
                        const subject = categoryKey === 'bday' ? `Happy Birthday, ${userFname}! 🎉` : `Happy Work Anniversary, ${userFname}! 🎉`;
                        if (categoryKey === 'workanni') {
                            var work_years = new Date().getFullYear() - new Date(row[4]).getFullYear();
                            var abb = work_years === 1 ? 'st' : work_years === 2 ? 'nd' : work_years === 3 ? 'rd' : 'th';
                        }
                        const message = categoryKey === 'bday'
                            ? `Dear ${row[1]},\n\nWishing you a very Happy Birthday! 🎂🎈\n\nWe value your special day just as much as we value you. On your birthday, we send you our warmest and most heartfelt wishes.\n\nWe are thrilled to be able to share this great day with you, and glad to have you as a valuable member of the team. We appreciate everything you’ve done to help us flourish and grow.\n\nOur entire corporate family at Movya Infotech wishes you a very happy birthday and wishes you the best on your special day!\n\nEnjoy your special day! 🎉\n\nBest wishes,\nTeam Movya Infotech`
                            : `Dear ${row[1]},\n\nCongratulations on reaching your ${work_years}${abb} Work Anniversary! 🎊\n\nToday, we celebrate not just the time you've spent with us but also the remarkable impact you've made at Movya Infotech. Your expertise, dedication, and innovative spirit have been instrumental in driving our success and fostering a positive team environment.\n\nAs you look back on your journey, we hope you take pride in all you've accomplished. Your contributions have helped shape our company’s vision and achievements, and we are excited to continue this journey together.\n\n\Thank you for being an invaluable part of our team. Here’s to many more years of collaboration and success!\n\nBest wishes,\nTeam Movya Infotech`;

                        try {
                            await sendEmailWithRetry({
                                email: userEmail,
                                subject,
                                message,
                            });
                            await logEmailSent(categoryKey, today, userEmail);
                            console.log(`${categoryKey} email sent to ${userEmail}`);
                            await delay(2000);
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
            const chunks = emailChunks(rows, 2); // Adjust chunk size as needed

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
                                : `Dear ${row[1]},\n\nWishing you and your family a joyous ${festivalName}! 🎉\n\nAs we approach the joyous occasion of ${festivalName}, I want to take a moment to extend my heartfelt wishes to you and your family. May this festival bring you an abundance of joy, love, and prosperity.\n\nThis is a wonderful time to celebrate and reflect on the moments that matter most. I hope you find time to enjoy the festivities and create cherished memories with your loved ones.\n\nWishing you a delightful and memorable ${festivalName} filled with happiness and warmth!\n\nBest wishes,\nTeam Movya Infotech`;

                        try {
                            await sendEmailWithRetry({
                                email: userEmail,
                                subject,
                                message,
                            });
                            await logEmailSent(categoryKey, today, userEmail, festivalName);
                            console.log(`${categoryKey} ${festivalName} email sent to ${userEmail}`);
                            await delay(2000);
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

        for (const festival of festivals) {
            const festivalName = festival[0];
            await sendFesEmailsInChunks(rows.slice(1), 'festival', festivalName);
        }



        // Function to send custom emails
        async function sendCustomEmails(rows) {
            const getCustomEmails = await googleSheets.spreadsheets.values.get({
                auth,
                spreadsheetId: customEmailSheetId,
                range: "Sheet1",
            });

            const customEmails = getCustomEmails.data.values || [];
            // console.log(customEmails)

            for (const customEmail of customEmails) {
                const [id, date, subject, body] = customEmail;

                if (date === today) {
                    const emailPromises = rows.map(async (row) => {
                        const userEmail = row[2];
                        const userFname = row[1].split(' ')[0];

                        if (userEmail && !await emailAlreadySent(userEmail, 'custom', today, id)) {
                            const personalizedSubject = subject?.replace('{name}', userFname) || subject;
                            const personalizedBody = body?.replace('{name}', userFname) || body;

                            try {
                                await sendEmailWithRetry({
                                    email: userEmail,
                                    subject: personalizedSubject,
                                    message: personalizedBody,
                                });
                                await logEmailSent('custom', today, userEmail, id);
                                console.log(`Custom email sent to ${userEmail}`);
                                await delay(2000);
                            } catch (error) {
                                console.error(`Error sending custom email to ${userEmail}: ${error.message}`);
                            }
                        }
                    });
                    await Promise.all(emailPromises);
                }
            }
        }

        // Send Custom Emails
        await sendCustomEmails(rows.slice(1));



    } catch (error) {
        console.log("Error in cron job:", error);
    }
});