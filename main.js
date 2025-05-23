document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('trip-form');
  const resultBox = document.getElementById('result');
  const historyList = document.getElementById('history-list');
  const db = [];

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    const location = document.getElementById('trip-location').value.trim();
    const budget = parseFloat(document.getElementById('budget').value);
    const food = parseFloat(document.getElementById('food').value) || 0;
    const travel = parseFloat(document.getElementById('travel').value) || 0;
    const stay = parseFloat(document.getElementById('stay').value) || 0;
    const shop = parseFloat(document.getElementById('shopping'))  || 0;
    const misc = parseFloat(document.getElementById('misc').value) || 0;
    const currency = document.getElementById('currency').value;

    const totalSpent = food + travel + stay + misc;
    const balance = budget - totalSpent;

    const summary = `Total Spent: ${currency}${totalSpent.toFixed(2)}<br>` +
      (balance >= 0
        ? `Remaining: ${currency}${balance.toFixed(2)}`
        : `<strong>Over Budget by ${currency}${Math.abs(balance).toFixed(2)}</strong>`);

    resultBox.innerHTML = summary;
    resultBox.classList.remove('hidden');

    const trip = {
      id: Date.now(),
      location,
      budget,
      totalSpent,
      currency,
      date: new Date().toLocaleString()
    };

    db.push(trip);
    renderHistory();
  });

  function renderHistory() {
    historyList.innerHTML = '';
    db.slice().reverse().forEach(item => {
      const li = document.createElement('li');
      li.innerHTML = `
        <button class="delete-btn" data-id="${item.id}">&times;</button>
        <strong>${item.location}</strong> — ${item.currency}${item.totalSpent.toFixed(2)} spent<br>
        <small>${item.date}</small>
      `;
      historyList.appendChild(li);
    });
  }

  historyList.addEventListener('click', function (e) {
    if (e.target.classList.contains('delete-btn')) {
      const id = parseInt(e.target.dataset.id);
      const index = db.findIndex(item => item.id === id);
      if (index > -1) {
        db.splice(index, 1);
        renderHistory();
      }
    }
  });

  // Map
  const map = L.map('map').setView([20.5937, 78.9629], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  let marker = null;

  document.getElementById('search-btn').addEventListener('click', () => {
    const query = document.getElementById('map-search').value.trim();
    if (!query) return;

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
      .then(res => res.json())
      .then(results => {
        if (results.length > 0) {
          const { lat, lon, display_name } = results[0];
          const latNum = parseFloat(lat);
          const lonNum = parseFloat(lon);

          if (marker) {
            marker.setLatLng([latNum, lonNum]);
          } else {
            marker = L.marker([latNum, lonNum]).addTo(map);
          }

          map.setView([latNum, lonNum], 10);
          document.getElementById('trip-location').value = display_name;
        } else {
          alert('Location not found');
        }
      })
      .catch(() => alert('Error finding location'));
  });
});
const originalDisplayHistory = displayHistory;
displayHistory = function () {
  const historyList = document.getElementById('history-list');
  const transaction = db.transaction(["trips"], "readonly");
  const store = transaction.objectStore("trips");

  const trips = [];

  store.openCursor(null, "prev").onsuccess = function (event) {
    const cursor = event.target.result;
    if (cursor) {
      trips.push(cursor.value);
      cursor.continue();
    } else {
historyList.innerHTML = trips.map(item => `
  <li class="history-entry" data-id="${item.id}">
    <button class="delete-btn" onclick='deleteTrip(${item.id})'>×</button>
    <strong>${item.location}</strong> — ${item.currency}${item.totalSpent} spent (Budget: ${item.currency}${item.budget})<br>
    <small>${item.date}</small><br>
    <button onclick='displayTripDetails(${JSON.stringify(item)})'>See Info</button>
  </li>
`).join('');
    }
  };
};