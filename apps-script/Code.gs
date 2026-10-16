/**
 * Google Apps Script backend for Haus am See reservations.
 *
 * SETUP (one time, ~3 minutes):
 * 1. Create a new Google Sheet. Name the first tab "Reservations".
 * 2. Add a header row (row 1) with these columns, in this order:
 *      Received | Reference | Room | Check in | Check out | Nights | Guests | Name | Email | Phone | Notes
 * 3. Extensions → Apps Script. Delete the sample, paste THIS file.
 * 4. (Optional) set a shared secret so random people can't POST to your sheet:
 *      edit SECRET below AND set SHEETS_WEBHOOK_SECRET to the same value in Vercel.
 * 5. Deploy → New deployment → type "Web app".
 *      - Execute as: Me
 *      - Who has access: Anyone
 *    Copy the Web app URL (ends in /exec).
 * 6. Paste that URL into Vercel env var SHEETS_WEBHOOK_URL. Done.
 */

// Leave "" to disable the check, or set to match SHEETS_WEBHOOK_SECRET in Vercel.
var SECRET = "";

// Where booking notifications go. Leave "" to disable.
var NOTIFY_EMAIL = "carolinednoonan@gmail.com";

// The Haus palette (matches the website).
var C = {
  cream: "#f6f1e7", sand: "#e9dec9", clay: "#b9a37e",
  forest: "#2f3e34", pine: "#44584a", lake: "#3f6d6a", ink: "#20231f",
};

// Pretty dates like "Fri, 10 Jul" from an ISO string.
function prettyDate(iso) {
  if (!iso) return "\u2014";
  var s = String(iso).slice(0, 10).split("-");
  if (s.length < 3) return String(iso);
  var d = new Date(Date.UTC(+s[0], +s[1] - 1, +s[2]));
  var wd = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getUTCDay()];
  var mo = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()];
  return wd + ", " + d.getUTCDate() + " " + mo;
}

function esc(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Email a notification for one booking (no-op if NOTIFY_EMAIL is empty).
function detailRow(label, value) {
  return '<tr>' +
    '<td style="padding:10px 0;border-bottom:1px solid ' + C.sand + ';font:13px/1.4 Helvetica,Arial,sans-serif;color:' + C.pine + ';text-transform:uppercase;letter-spacing:.06em;width:34%;vertical-align:top;">' + esc(label) + '</td>' +
    '<td style="padding:10px 0;border-bottom:1px solid ' + C.sand + ';font:16px/1.5 Georgia,\'Times New Roman\',serif;color:' + C.ink + ';">' + value + '</td>' +
    '</tr>';
}

// Shared Haus-styled email card. `rows` is pre-built HTML, `headline`/`intro` vary by audience.
function cardHtml(headline, intro, rows, reference) {
  return '<div style="background:' + C.cream + ';padding:28px 12px;font-family:Helvetica,Arial,sans-serif;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">' +
      '<tr><td style="background:' + C.forest + ';border-radius:16px 16px 0 0;padding:26px 30px;">' +
        '<div style="font:12px/1 Helvetica,Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:' + C.clay + ';">The Haus &middot; Bayrischzell</div>' +
        '<div style="margin-top:8px;font:600 26px/1.2 Georgia,\'Times New Roman\',serif;color:' + C.cream + ';">' + headline + '</div>' +
      '</td></tr>' +
      '<tr><td style="background:#fff;padding:26px 30px;">' +
        '<p style="margin:0 0 18px;font:17px/1.6 Georgia,\'Times New Roman\',serif;color:' + C.ink + ';">' + intro + '</p>' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + rows + '</table>' +
        (reference ? '<div style="margin-top:22px;display:inline-block;background:' + C.sand + ';color:' + C.forest + ';font:13px/1 Helvetica,Arial,sans-serif;letter-spacing:.08em;padding:9px 14px;border-radius:999px;">Ref ' + esc(reference) + '</div>' : '') +
      '</td></tr>' +
      '<tr><td style="background:#fff;border-radius:0 0 16px 16px;padding:18px 30px 26px;border-top:1px solid ' + C.sand + ';">' +
        '<p style="margin:0;font:13px/1.6 Helvetica,Arial,sans-serif;color:' + C.pine + ';">Reitberg 16, 83735 Bayrischzell &middot; it\u2019s on us \uD83E\uDD0D</p>' +
      '</td></tr>' +
    '</table>' +
  '</div>';
}

function stayRows(b) {
  return detailRow("Room", esc(b.room || "\u2014")) +
    detailRow("Dates", esc(prettyDate(b.checkIn)) + ' <span style="color:' + C.clay + ';">\u2192</span> ' + esc(prettyDate(b.checkOut))) +
    detailRow("Nights", esc(b.nights || "\u2014")) +
    detailRow("Guests", esc(b.guests || "\u2014"));
}

function stayPlain(b) {
  return (b.room || "") + "\n" +
    prettyDate(b.checkIn) + " \u2192 " + prettyDate(b.checkOut) +
    "  \u00B7  " + (b.nights || "") + " night(s)  \u00B7  " + (b.guests || "") + " guest(s)\n" +
    "Ref: " + (b.reference || "") + "\n";
}

// Host notification — goes to NOTIFY_EMAIL (Caroline).
function notify(data, b) {
  if (!NOTIFY_EMAIL) return;
  var name = data.name || "A guest";
  var subject = "\uD83C\uDFD4\uFE0F New stay request \u2014 " + (b.room || "The Haus") +
    " \u00B7 " + prettyDate(b.checkIn);

  var plain = name + " (" + (data.email || "") + (data.phone ? ", " + data.phone : "") + ")\n" +
    stayPlain(b) + (data.notes ? "Notes: " + data.notes + "\n" : "");

  var contact = esc(name) +
    ' &middot; <a href="mailto:' + esc(data.email) + '" style="color:' + C.lake + ';text-decoration:none;">' + esc(data.email) + '</a>' +
    (data.phone ? ' &middot; ' + esc(data.phone) : '');

  var rows = stayRows(b) + detailRow("Contact", contact) + (data.notes ? detailRow("Notes", esc(data.notes)) : "");
  var html = cardHtml("New stay request \uD83C\uDFD4\uFE0F",
    '<strong>' + esc(name) + '</strong> would like to stay.', rows, b.reference || "\u2014");

  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    subject: subject,
    body: plain,
    htmlBody: html,
    name: "The Haus",
    replyTo: data.email || NOTIFY_EMAIL,
  });
}

// Guest confirmation — one email to the booker covering all their stays.
// `bookings` is an array; no-op if we have no email to reach them.
function notifyGuest(data, bookings) {
  if (!data.email || !bookings || !bookings.length) return;
  var first = (data.name || "there").split(" ")[0];
  var many = bookings.length > 1;
  var subject = many
    ? "Your " + bookings.length + " stays at The Haus"
    : "Your stay at The Haus \u2014 " + (bookings[0].room || "") + " \u00B7 " + prettyDate(bookings[0].checkIn);

  var plain = "Hi " + first + ",\n\nThanks \u2014 we've got your " + (many ? bookings.length + " requests" : "request") +
    " and we'll be in touch shortly to confirm. Nothing to pay, ever.\n\n";
  var rows = "";
  for (var i = 0; i < bookings.length; i++) {
    if (many) {
      rows += detailRow("Stay " + (i + 1), '<span style="color:' + C.pine + ';">Ref ' + esc(bookings[i].reference || "\u2014") + '</span>');
    }
    rows += stayRows(bookings[i]);
    plain += stayPlain(bookings[i]) + "\n";
  }
  plain += "Reitberg 16, 83735 Bayrischzell\n";

  var intro = "Hi <strong>" + esc(first) + "</strong> \u2014 thanks! We\u2019ve got your " +
    (many ? esc(bookings.length) + " requests" : "request") +
    " and we\u2019ll be in touch shortly to confirm. Nothing to pay, ever. \uD83E\uDD0D";
  var html = cardHtml("You\u2019re on the list \uD83C\uDFD4\uFE0F", intro, rows, many ? "" : (bookings[0].reference || "\u2014"));

  MailApp.sendEmail({
    to: data.email,
    subject: subject,
    body: plain,
    htmlBody: html,
    name: "The Haus",
    replyTo: NOTIFY_EMAIL || data.email,
  });
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (SECRET && data.secret !== SECRET) {
      return json({ ok: false, error: "unauthorized" });
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Reservations")
      || SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

    // Batch: multiple bookings in one request (shared guest info). Written in a
    // single setValues() call so up to 10 rows land atomically and fast.
    if (data.bookings && data.bookings.length) {
      var rows = data.bookings.map(function (b) {
        return [
          data.submittedAt || new Date().toISOString(),
          b.reference || "",
          b.room || "",
          b.checkIn || "",
          b.checkOut || "",
          b.nights || "",
          b.guests || "",
          data.name || "",
          data.email || "",
          data.phone || "",
          data.notes || "",
        ];
      });
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
      data.bookings.forEach(function (b) { notify(data, b); });
      notifyGuest(data, data.bookings);
      return json({ ok: true });
    }

    sheet.appendRow([
      data.submittedAt || new Date().toISOString(),
      data.reference || "",
      data.room || "",
      data.checkIn || "",
      data.checkOut || "",
      data.nights || "",
      data.guests || "",
      data.name || "",
      data.email || "",
      data.phone || "",
      data.notes || "",
    ]);

    notify(data, data);
    notifyGuest(data, [data]);

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/**
 * doGet — returns upcoming reservations for the "Who's coming" feature.
 * Only non-sensitive fields are returned (reference, room, dates, guests, name).
 * Email / phone / notes are never exposed.
 */
function doGet(e) {
  try {
    if (SECRET && (!e || e.parameter.secret !== SECRET)) {
      return json({ ok: false, error: "unauthorized" });
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Reservations")
      || SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var rows = sheet.getDataRange().getValues();

    var out = [];
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      if (!r[1] && !r[7]) continue; // skip blank rows (no reference & no name)
      out.push({
        reference: r[1],
        room: r[2],
        checkIn: fmtDate(r[3]),
        checkOut: fmtDate(r[4]),
        guests: r[6],
        name: r[7],
      });
    }
    return json({ ok: true, reservations: out });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

// Cells may come back as strings ("2026-07-10") or Date objects — normalise to YYYY-MM-DD.
function fmtDate(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(v).slice(0, 10);
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
