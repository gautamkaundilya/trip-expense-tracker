const PAGE_SIZE = 5;
let allTrips = [];
let currentPage = 0;

let db;

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('trip-form');
  const resultBox = document.getElementById('result');
  const historyList = document.getElementById('history-list');

  const request = indexedDB.open("TripBudgetDB", 1);
  request.onupgradeneeded = function (event) {
    db = event.target.result;
    db.createObjectStore("trips", { keyPath: "id", autoIncrement: true });
  };
  request.onsuccess = function (event) {
    db = event.target.result;
    displayHistory();
  };
  request.onerror = function (event) {
    console.error("IndexedDB error:", event.target.errorCode);
  };

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    const startDate = document.getElementById('trip-start').value;
    const endDate = document.getElementById('trip-end').value;
    const location = document.getElementById('trip-location').value.trim();
    const budget = parseFloat(document.getElementById('budget').value);
    const food = parseFloat(document.getElementById('food').value) || 0;
    const travel = parseFloat(document.getElementById('travel').value) || 0;
    const stay = parseFloat(document.getElementById('stay').value) || 0;
    const shop = parseFloat(document.getElementById('shopping').value) || 0;
    const misc = parseFloat(document.getElementById('misc').value) || 0;
    const currency = document.getElementById('currency').value;
    const totalPersons = parseInt(document.getElementById('Number-of-person').value);
    const male = parseInt(document.getElementById('Male').value);
    const female = parseInt(document.getElementById('Female').value);

    const totalSpent = food + travel + stay + shop + misc;
    const balance = budget - totalSpent;
    const days = calculateTripDays(startDate, endDate);

    const summary = `Total Spent: ${currency}${totalSpent.toFixed(2)}<br>` +
      (balance >= 0
        ? `Remaining: ${currency}${balance.toFixed(2)}`
        : `<strong>Over Budget by ${currency}${Math.abs(balance).toFixed(2)}</strong>`) +
      `<br>Total Trip Days: ${days}`;

    resultBox.innerHTML = summary;
    resultBox.classList.remove('hidden');

    const trip = {
      location,
      budget,
      totalSpent,
      currency,
      date: new Date().toLocaleString(),
      startDate,
      endDate,
      days,
      food,
      travel,
      stay,
      shop,
      misc,
      totalPersons,
      male,
      female
    };

    saveTrip(trip);
  });

function saveTrip(trip) {
  const readTransaction = db.transaction(["trips"], "readonly");
  const store = readTransaction.objectStore("trips");
  const tripsToDelete = [];

  store.openCursor().onsuccess = function (event) {
    const cursor = event.target.result;
    if (cursor) {
      const existing = cursor.value;
      if (
        existing.location === trip.location &&
        existing.startDate === trip.startDate &&
        existing.endDate === trip.endDate &&
        existing.budget === trip.budget
      ) {
        tripsToDelete.push(cursor.key); // store key to delete
      }
      cursor.continue();
    } else {
      // Step 2: Delete duplicates
      if (tripsToDelete.length > 0) {
        const deleteTransaction = db.transaction(["trips"], "readwrite");
        const deleteStore = deleteTransaction.objectStore("trips");
        tripsToDelete.forEach(key => deleteStore.delete(key));
        deleteTransaction.oncomplete = () => {
          addTrip(trip);
        };
      } else {
        // No duplicates, directly add
        addTrip(trip);
      }
    }
  };
}

function addTrip(trip) {
  const addTransaction = db.transaction(["trips"], "readwrite");
  const addStore = addTransaction.objectStore("trips");
  addStore.add(trip);
  addTransaction.oncomplete = () => displayHistory(true);
}


function displayHistory(initial = true) {
  const transaction = db.transaction(["trips"], "readonly");
  const store = transaction.objectStore("trips");
  const trips = [];

  store.openCursor(null, "prev").onsuccess = function (event) {
    const cursor = event.target.result;
    if (cursor) {
      trips.push({ ...cursor.value, id: cursor.key });
      cursor.continue();
    } else {
      if (initial) {
        allTrips = trips;
        currentPage = 0;
        document.getElementById("history-list").innerHTML = '';
      }
      renderNextPage();
    }
  };
}

function renderNextPage() {
  const historyList = document.getElementById('history-list');
  const start = currentPage * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageItems = allTrips.slice(start, end);

  pageItems.forEach(item => {
    const li = document.createElement('li');
    li.className = 'history-entry';
    li.dataset.id = item.id;
    li.innerHTML = `
      <button class="delete-btn" data-id="${item.id}">&times;</button>
      <strong>${item.location}</strong> — ${item.currency}${item.totalSpent} spent (Budget: ${item.currency}${item.budget})<br>
      <small>${item.date}</small><br>
      <button onclick='displayTripDetails(${JSON.stringify(item)})'>See Info</button>
    `;
    historyList.appendChild(li);
  });

  currentPage++;
}
window.addEventListener('scroll', () => {
  const scrollBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 200;
  if (scrollBottom && currentPage * PAGE_SIZE < allTrips.length) {
    renderNextPage();
  }
});


  historyList.addEventListener('click', function (e) {
    if (e.target.classList.contains('delete-btn')) {
      const id = parseInt(e.target.dataset.id);
      const transaction = db.transaction(["trips"], "readwrite");
      const store = transaction.objectStore("trips");
      store.delete(id);
      transaction.oncomplete = () => displayHistory();
    }
  });

  initializeMap();
});

function displayTripDetails(trip) {
  const details = `
Trip to: ${trip.location}
Start Date: ${trip.startDate}
End Date: ${trip.endDate}
Total Days: ${trip.days}
Total Persons: ${trip.totalPersons} (Male: ${trip.male}, Female: ${trip.female})

--- Expenses ---
Food: ${trip.currency}${trip.food}
Travel: ${trip.currency}${trip.travel}
Stay: ${trip.currency}${trip.stay}
Shopping: ${trip.currency}${trip.shop}
Miscellaneous: ${trip.currency}${trip.misc}

Total Spent: ${trip.currency}${trip.totalSpent}
Budget: ${trip.currency}${trip.budget}
Date Recorded: ${trip.date}
  `;
  alert(details);
}

function calculateTripDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const msPerDay = 1000 * 60 * 60 * 24;
  const diff = Math.round((end - start) / msPerDay) + 1;
  return isNaN(diff) ? 0 : diff;
}

function initializeMap() {
  if (typeof L === 'undefined') {
    console.error('Leaflet not loaded!');
    return;
  }

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
}
document.addEventListener('DOMContentLoaded', () => {
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = lightbox.querySelector('img');

  document.querySelectorAll('.photo-grid img').forEach(img => {
    img.addEventListener('click', () => {
      lightboxImg.src = img.src;
      lightbox.classList.add('active');
    });
  });

  lightbox.addEventListener('click', () => {
    lightbox.classList.remove('active');
  });
});

