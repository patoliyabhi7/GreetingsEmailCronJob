const { schedule } = require('@netlify/functions');
const sendEmail = require('./../../utils/email');
const { google } = require('googleapis');

exports.handler = schedule('2 1 * * *', async (event, context) => {
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
                                // If wants to add attachments
                                // fileName: "demo.pdf",
                                // filePath: "./Google.pdf"
                            });
                            console.log("bday email sent", row[2]);
                            await delay(2000);
                        } catch (error) {
                            console.error(`Error sending email: ${error}`);
                        }
                    }
                }
            });
        // await delay(5000);

        // Anniversary wish using Google Sheets
        const anniversary = getRows.data.values.filter(
            async (row) => {
                if (row[4].slice(5) == now) {
                    if (row[2]) {
                        const userFname = row[1].split(' ')[0];
                        const years = new Date().getFullYear() - new Date(row[4]).getFullYear();
                        const abb = years === 1 ? 'st' : years === 2 ? 'nd' : years === 3 ? 'rd' : 'th';
                        try {
                            await sendEmail({
                                email: row[2],
                                subject: `Happy Work Anniversary, ${userFname}!`,
                                message: `Dear ${row[1]},
    
Congratulations on your ${years}${abb} work anniversary! 🎉
    
Your dedication, hard work, and contributions have been instrumental to our success. We are grateful to have you as part of our team and look forward to many more successful years together.
    
Thank you for your continued commitment, and here’s to celebrating more milestones in the future!
    
Best wishes,
Team Movya Infotech`
                            });
                            console.log("anniversary email sent", row[2]);
                            await delay(2000);
                        } catch (error) {
                            console.error(`Error sending email: ${error}`);
                        }
                    }
                }
            });
        await delay(5000);

        // Festival wish using Google Sheets
        const getFesRows = await googleSheets.spreadsheets.values.get({
            auth,
            spreadsheetId: festivalSheetId,
            range: "Sheet1",
        });

        //         const festivals = getFesRows.data.values.filter(async (row) => {
        //             if (row[1] === today) {
        //                 const festival_name = row[0];
        //                 const userRecords = getRows.data.values.slice(1);

        //                 for (const user of userRecords) {
        //                     if (user[2]) {
        //                         const userFname = user[1].split(' ')[0];

        //                         try {
        //                             await sendEmail({
        //                                 email: user[2],
        //                                 subject: `Happy ${festival_name}, ${userFname}!`,
        //                                 message: `Dear ${user[1]},

        // As ${festival_name} approaches, I wanted to extend my heartfelt wishes to you and your loved ones. May this festive season bring you joy, peace, and prosperity.

        // Let’s take this opportunity to celebrate, reflect, and recharge. I hope you enjoy the festivities and create beautiful memories with those who matter most.

        // Wishing you a wonderful ${festival_name}!

        // Best wishes,
        // Team Movya Infotech`
        //                             });
        //                             console.log("festival email sent", user[2]);
        //                             await delay(2000);
        //                         } catch (error) {
        //                             console.error(`Error sending email: ${error}`);
        //                         }

        //                         // Add a delay of 2 seconds between emails
        //                     }
        //                 }
        //             }
        //         });
        const festivals = getFesRows.data.values;
        for (const row of festivals) {
            if (row[1] === today) {
                const festival_name = row[0];
                const userRecords = getRows.data.values.slice(1);

                for (const user of userRecords) {
                    if (user[2]) {
                        const userFname = user[1].split(' ')[0];

                        try {
                            await sendEmail({
                                email: user[2],
                                subject: `Happy ${festival_name}, ${userFname}!`,
                                message: `Dear ${user[1]},

As ${festival_name} approaches, I wanted to extend my heartfelt wishes to you and your loved ones. May this festive season bring you joy, peace, and prosperity.
    
Let’s take this opportunity to celebrate, reflect, and recharge. I hope you enjoy the festivities and create beautiful memories with those who matter most.
    
Wishing you a wonderful ${festival_name}!
    
Best wishes,
Team Movya Infotech`
                            });
                            console.log("festival email sent", user[2]);
                            await delay(2000);
                        } catch (error) {
                            console.error(`Error sending email: ${error}`);
                        }
                    }
                }
            }
        }
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