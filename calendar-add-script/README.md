# Calendar Add Script — Setup

This Google Apps Script powers the PIN-protected "Add to calendar" form on the home page.

## Setup steps

1. **Create the script**
   - Go to [script.google.com](https://script.google.com)
   - New project
   - Delete the default code and paste the contents of `Code.gs`

2. **Set your PIN**
   - Change `VALID_PIN = '1234'` to your real 4-digit PIN
   - Share this PIN with your girlfriend

3. **Deploy**
   - Click **Deploy** → **New deployment**
   - Click the gear icon → **Web app**
   - **Execute as:** Me
   - **Who has access:** Anyone
   - Click **Deploy**
   - Copy the **Web app URL** (looks like `https://script.google.com/macros/s/.../exec`)

4. **Connect the form**
   - Open `index.html` in the site root
   - Find the form with `id="calendarSubmitForm"`
   - Replace `YOUR_DEPLOYMENT_ID` in the `action` attribute with your deployment ID from the URL
   - Or replace the entire `action` value with your full Web app URL

Example: If your URL is  
`https://script.google.com/macros/s/AKfycbx123abc.../exec`  
then the form action should be that full URL.
