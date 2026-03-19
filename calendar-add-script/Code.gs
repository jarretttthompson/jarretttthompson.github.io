/**
 * Google Apps Script: PIN-protected calendar submission
 *
 * SETUP:
 * 1. Go to script.google.com and create a new project
 * 2. Replace the code with this file's contents
 * 3. Change VALID_PIN to your 4-digit PIN
 * 4. Optional: Change CALENDAR_ID to a specific calendar (leave null for default)
 * 5. Deploy: Deploy > New deployment > Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Copy the Web app URL and paste it into index.html as the form's action attribute
 */

const VALID_PIN = '0520';

function doGet() {
  return ContentService.createTextOutput(
    '<html><body style="font-family:sans-serif;background:#1a0f28;color:#f0e6f6;padding:40px;text-align:center"><p>Use the form on the website to add events.</p></body></html>'
  ).setMimeType(ContentService.MimeType.HTML);
}
const CALENDAR_ID = '426e2946bb067a75e341e40434288cb5db457131576722b266af50527137c7d9@group.calendar.google.com';  // Your calendar

function doPost(e) {
  let success = false;
  let message = '';

  try {
    const params = (e && e.parameter) ? e.parameter : {};
    const pin = String(params.pin || '').trim();
    const title = String(params.title || 'Calendar Entry').trim();
    const date = String(params.date || '').trim();
    const timeStart = String(params.time_start || params.time || '09:00').trim();
    const timeEnd = String(params.time_end || '10:00').trim();
    const description = String(params.description || '').trim();

    if (pin !== VALID_PIN) {
      message = 'Invalid PIN. Please try again.';
    } else if (!title || !date) {
      message = 'Please provide a title and date.';
    } else {
      const calendar = CALENDAR_ID
        ? CalendarApp.getCalendarById(CALENDAR_ID)
        : CalendarApp.getDefaultCalendar();

      if (!calendar) {
        message = 'Calendar not found. Check CALENDAR_ID in the script.';
      } else {
        const startDateTime = new Date(date + 'T' + timeStart + ':00');
        let endDateTime = new Date(date + 'T' + timeEnd + ':00');
        if (endDateTime <= startDateTime) {
          endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);
        }

        calendar.createEvent(title, startDateTime, endDateTime, {
          description: description || null
        });

        success = true;
        message = 'Event added successfully!';
      }
    }
  } catch (err) {
    message = 'Error: ' + String(err);
  }

  const json = JSON.stringify({ success: success, message: message });
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
