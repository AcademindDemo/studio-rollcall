import { HttpRouter, HttpServerResponse } from "effect/http"

// One self-contained page: inline CSS and script, no build step, no external assets.
// It calls only the /staff JSON endpoints, so the endpoint tests cover what it shows.
// The script builds every node with textContent, never innerHTML, so names can't inject markup.
export const staffPageHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Studio Rollcall: staff</title>
<style>
  body { font: 15px/1.4 system-ui, sans-serif; margin: 0; color: #1d1d1f; background: #f6f6f4; }
  header { background: #26364a; color: #fff; padding: 12px 20px; }
  header h1 { margin: 0; font-size: 18px; }
  main { display: grid; grid-template-columns: minmax(280px, 1fr) minmax(320px, 1.4fr); gap: 16px; padding: 16px 20px; }
  section { background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 12px 14px; }
  section h2 { margin: 0 0 8px; font-size: 16px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; padding: 4px 6px; border-bottom: 1px solid #eee; vertical-align: top; }
  tr.class-row { cursor: pointer; }
  tr.class-row:hover, tr.selected { background: #eef3fa; }
  .flag { display: inline-block; background: #fbe3c8; color: #7a3d00; border-radius: 3px; padding: 0 5px; margin-right: 4px; font-size: 12px; }
  .muted { color: #777; }
  .error { color: #a40000; }
  button { font: inherit; padding: 2px 10px; cursor: pointer; }
  form { display: grid; grid-template-columns: max-content 1fr; gap: 6px 10px; align-items: center; }
  form button { grid-column: 2; justify-self: start; }
  #classes-section { grid-row: span 2; }
</style>
</head>
<body>
<header><h1>Studio Rollcall: staff</h1></header>
<main>
  <section id="classes-section">
    <h2>This week's classes</h2>
    <table><thead><tr><th>Starts (UTC)</th><th>Class</th><th>Room</th><th>Instructor</th><th>Spots left</th></tr></thead>
    <tbody id="classes"></tbody></table>
  </section>
  <section>
    <h2 id="roster-title">Roster</h2>
    <p id="roster-status" class="muted">Pick a class to see its roster and waitlist.</p>
    <table><thead><tr><th>Member</th><th>Status</th><th>Check-in</th></tr></thead><tbody id="roster"></tbody></table>
    <h3>Waitlist</h3>
    <table><thead><tr><th>#</th><th>Member</th><th>Joined (UTC)</th><th>Status</th></tr></thead><tbody id="waitlist"></tbody></table>
  </section>
  <section>
    <h2>Members</h2>
    <table><thead><tr><th>Member</th><th>Credits</th><th>Next pack expiry</th><th>Membership ends</th><th>Renewal</th><th>Flags</th></tr></thead>
    <tbody id="members"></tbody></table>
  </section>
  <section>
    <h2>Add a weekly class</h2>
    <form id="add-class">
      <label for="f-title">Title</label><input id="f-title" name="title" required>
      <label for="f-weekday">Weekday</label>
      <select id="f-weekday" name="weekday">
        <option>monday</option><option>tuesday</option><option>wednesday</option><option>thursday</option>
        <option>friday</option><option>saturday</option><option>sunday</option>
      </select>
      <label for="f-start">Start (UTC)</label><input id="f-start" name="startTime" type="time" required>
      <label for="f-duration">Minutes</label><input id="f-duration" name="durationMinutes" type="number" min="1" value="60" required>
      <label for="f-room">Room</label><input id="f-room" name="room" required>
      <label for="f-instructor">Instructor</label><input id="f-instructor" name="instructor" required>
      <label for="f-capacity">Capacity</label><input id="f-capacity" name="capacity" type="number" min="1" value="10" required>
      <button type="submit">Add class</button>
    </form>
    <p id="add-status" class="muted"></p>
    <h3>Weekly classes</h3>
    <table><thead><tr><th>Weekday</th><th>Start</th><th>Class</th><th>Room</th><th>Capacity</th></tr></thead>
    <tbody id="weekly"></tbody></table>
  </section>
</main>
<script>
(function () {
  "use strict";
  var selected = null;
  var names = {};

  function el(tag, text, className) {
    var node = document.createElement(tag);
    if (text !== undefined && text !== null) node.textContent = String(text);
    if (className) node.className = className;
    return node;
  }
  function row(cells) {
    var tr = document.createElement("tr");
    cells.forEach(function (cell) {
      var td = document.createElement("td");
      if (cell instanceof Node) td.appendChild(cell); else td.textContent = cell === undefined ? "" : String(cell);
      tr.appendChild(td);
    });
    return tr;
  }
  function when(iso) { return iso ? iso.slice(0, 16).replace("T", " ") : ""; }
  function day(iso) { return iso ? iso.slice(0, 10) : ""; }
  function api(method, path, body) {
    var init = { method: method, headers: {} };
    if (body !== undefined) { init.headers["content-type"] = "application/json"; init.body = JSON.stringify(body); }
    return fetch(path, init).then(function (res) {
      return res.text().then(function (text) {
        var data = text ? JSON.parse(text) : null;
        if (!res.ok) throw new Error((data && (data._tag || data.message)) || ("HTTP " + res.status));
        return data;
      });
    });
  }
  function fill(id, rows) {
    var body = document.getElementById(id);
    body.replaceChildren.apply(body, rows);
  }

  function loadClasses() {
    return api("GET", "/staff/classes").then(function (classes) {
      fill("classes", classes.map(function (c) {
        var tr = row([when(c.startsAt), c.title, c.room, c.instructor, c.spotsLeft + " / " + c.capacity]);
        tr.className = "class-row" + (c.id === selected ? " selected" : "");
        tr.dataset.classId = c.id;
        tr.addEventListener("click", function () { selected = c.id; loadClasses(); loadRoster(); });
        return tr;
      }));
    });
  }

  // A failed check-in passes its message, so the reload keeps it visible.
  function loadRoster(failure) {
    if (selected === null) return Promise.resolve();
    var classId = selected;
    var status = document.getElementById("roster-status");
    return api("GET", "/staff/classes/" + encodeURIComponent(classId) + "/roster").then(function (r) {
      // A response for a class that is no longer selected is stale.
      if (classId !== selected) return;
      var c = r.classListing;
      document.getElementById("roster-title").textContent = "Roster: " + c.title + ", " + when(c.startsAt);
      status.textContent = r.bookings.filter(function (b) { return b.status === "booked"; }).length + " booked, " +
        c.spotsLeft + " spots left, " + c.walkInHolds + " held for walk-ins";
      status.className = "muted";
      if (failure) { status.textContent = "Check-in failed: " + failure; status.className = "error"; }
      fill("roster", r.bookings.map(function (b) {
        var action;
        if (b.status !== "booked") action = el("span", "", "muted");
        else if (b.checkedInAt) action = el("span", "checked in " + when(b.checkedInAt));
        else {
          action = el("button", "Check in");
          action.dataset.bookingId = b.id;
          action.addEventListener("click", function () { checkIn(b.id, action); });
        }
        return row([names[b.memberId] || b.memberId, b.status + (b.source === "waitlist" ? " (from waitlist)" : ""), action]);
      }));
      fill("waitlist", r.waitlist.map(function (w, i) {
        return row([i + 1, names[w.memberId] || w.memberId, when(w.joinedAt), w.status]);
      }));
    }).catch(function (e) {
      if (classId !== selected) return;
      status.textContent = "Could not load roster: " + e.message; status.className = "error";
    });
  }

  function checkIn(bookingId, button) {
    button.disabled = true;
    return api("POST", "/staff/bookings/" + encodeURIComponent(bookingId) + "/check-in")
      .then(function () { return loadRoster(); }, function (e) { return loadRoster(e.message); });
  }

  function loadMembers() {
    return api("GET", "/staff/members").then(function (rows) {
      rows.forEach(function (m) { names[m.member.id] = m.member.name; });
      fill("members", rows.map(function (m) {
        var flags = document.createElement("span");
        m.flags.forEach(function (f) { flags.appendChild(el("span", f, "flag")); });
        var b = m.balance;
        return row([m.member.name, b.packCreditsLeft, day(b.nextPackExpiry), day(b.membershipEndsAt), b.renewal || "", flags]);
      }));
    });
  }

  function loadWeekly() {
    return api("GET", "/staff/weekly-classes").then(function (weekly) {
      fill("weekly", weekly.map(function (w) { return row([w.weekday, w.startTime, w.title, w.room, w.capacity]); }));
    });
  }

  document.getElementById("add-class").addEventListener("submit", function (event) {
    event.preventDefault();
    var form = event.target;
    var status = document.getElementById("add-status");
    var input = {
      title: form.title.value, weekday: form.weekday.value, startTime: form.startTime.value,
      durationMinutes: Number(form.durationMinutes.value), room: form.room.value,
      instructor: form.instructor.value, capacity: Number(form.capacity.value)
    };
    api("POST", "/staff/weekly-classes", input).then(function (w) {
      status.textContent = "Added " + w.title + " on " + w.weekday + "s at " + w.startTime + ".";
      status.className = "muted";
      return Promise.all([loadWeekly(), loadClasses()]);
    }).catch(function (e) { status.textContent = "Could not add class: " + e.message; status.className = "error"; });
  });

  loadMembers().then(function () { return Promise.all([loadClasses(), loadWeekly()]); });
})();
</script>
</body>
</html>
`

export const StaffPageLive = HttpRouter.add("GET", "/staff/", HttpServerResponse.html(staffPageHtml))
