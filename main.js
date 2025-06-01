// Constants for pagination
const PAGE_SIZE = 5;
let allTrips = [];
let currentPage = 0;
let db; // IndexedDB instance

// Wait for DOM content to load
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('trip-form');
  const resultBox = document.getElementById('result');
  const historyList = document.getElementById('history-list');

  // Open (or create) IndexedDB
  const request = indexedDB.open("TripBudgetDB", 1);

  // If database is new or needs an upgrade
  request.onupgradeneeded = function (event) {
    db = event.target.result;
    db.createObjectStore("trips", { keyPath: "id", autoIncrement: true });
  };

  // On success, assign DB and load history
  request.onsuccess = function (event) {
    db = event.target.result;
    displayHistory();
  };

  request.onerror = function (event) {
    console.error("IndexedDB error:", event.target.errorCode);
  };

  // Handle form submission
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    // Collect input values
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

    // Calculate totals
    const totalSpent = food + travel + stay + shop + misc;
    const balance = budget - totalSpent;
    const days = calculateTripDays(startDate, endDate);

    // Show result
    const summary = `Total Spent: ${currency}${totalSpent.toFixed(2)}<br>` +
      (balance >= 0
        ? `Remaining: ${currency}${balance.toFixed(2)}`
        : `<strong>Over Budget by ${currency}${Math.abs(balance).toFixed(2)}</strong>`) +
      `<br>Total Trip Days: ${days}`;
    resultBox.innerHTML = summary;
    resultBox.classList.remove('hidden');

    // Create trip object
    const trip = {
      location, budget, totalSpent, currency,
      date: new Date().toLocaleString(),
      startDate, endDate, days,
      food, travel, stay, shop, misc,
      totalPersons, male, female
    };

    saveTrip(trip); // Save to database
  });

  // Save new trip and remove duplicate
  function saveTrip(trip) {
    const readTransaction = db.transaction(["trips"], "readonly");
    const store = readTransaction.objectStore("trips");
    const tripsToDelete = [];

    store.openCursor().onsuccess = function (event) {
      const cursor = event.target.result;
      if (cursor) {
        const existing = cursor.value;

        // Check if existing trip matches
        if (
          existing.location === trip.location &&
          existing.startDate === trip.startDate &&
          existing.endDate === trip.endDate &&
          existing.budget === trip.budget
        ) {
          tripsToDelete.push(cursor.key);
        }
        cursor.continue();
      } else {
        // Delete old, add new
        if (tripsToDelete.length > 0) {
          const deleteTransaction = db.transaction(["trips"], "readwrite");
          const deleteStore = deleteTransaction.objectStore("trips");
          tripsToDelete.forEach(key => deleteStore.delete(key));
          deleteTransaction.oncomplete = () => {
            addTrip(trip);
          };
        } else {
          addTrip(trip);
        }
      }
    };
  }

  // Add trip to database
  function addTrip(trip) {
    const addTransaction = db.transaction(["trips"], "readwrite");
    const addStore = addTransaction.objectStore("trips");
    addStore.add(trip);
    addTransaction.oncomplete = () => displayHistory(true);
  }

  // Display all trips
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

  // Show next page of history
  function renderNextPage() {
    const historyList = document.getElementById('history-list');
    const start = currentPage * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageItems = allTrips.slice(start, end);

    // Create list items
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

  // Load more trips on scroll
  window.addEventListener('scroll', () => {
    const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 200;
    if (nearBottom && currentPage * PAGE_SIZE < allTrips.length) {
      renderNextPage();
    }
  });

  // Handle deleting a trip
  historyList.addEventListener('click', function (e) {
    if (e.target.classList.contains('delete-btn')) {
      const id = parseInt(e.target.dataset.id);
      const transaction = db.transaction(["trips"], "readwrite");
      const store = transaction.objectStore("trips");
      store.delete(id);
      transaction.oncomplete = () => displayHistory();
    }
  });

  // Start the map once DOM is ready
  initializeMap();
});

// Show a trip's details in an alert box
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

// Calculate days between two dates
function calculateTripDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const msPerDay = 1000 * 60 * 60 * 24;
  const diff = Math.round((end - start) / msPerDay) + 1;
  return isNaN(diff) ? 0 : diff;
}

// Setup Leaflet map and search
function initializeMap() {
  if (typeof L === 'undefined') {
    console.error('Leaflet not loaded!');
    return;
  }

  const map = L.map('map').setView([20.5937, 78.9629], 5); // India

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  let marker = null;

  // Search and move map
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

// Lightbox image viewer logic
document.addEventListener('DOMContentLoaded', () => {
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = lightbox.querySelector('img');

  // Open lightbox on image click
  document.querySelectorAll('.photo-grid img').forEach(img => {
    img.addEventListener('click', () => {
      lightboxImg.src = img.src;
      lightbox.classList.add('active');
    });
  });

  // Close lightbox on click
  lightbox.addEventListener('click', () => {
    lightbox.classList.remove('active');
  });
});
