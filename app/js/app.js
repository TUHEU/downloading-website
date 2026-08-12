/**
 * GlobeTrotter web app — vanilla JS, hash-based router + view functions.
 * Talks to the same API Gateway as the Flutter app via api.js.
 */

// ---------------------------------------------------------------------
// small utilities
// ---------------------------------------------------------------------
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.toggle('toast-error', isError);
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 2600);
}

function navigate(hash) {
  window.location.hash = hash;
}

function categoryLabel(cat) {
  const labels = {
    nature: 'Nature', market: 'Market', landmark: 'Landmark',
    museum: 'Museum', sports: 'Sports', neighborhood: 'Neighborhood',
  };
  return labels[cat] || cat || '';
}

// ---------------------------------------------------------------------
// router
// ---------------------------------------------------------------------
class Router {
  constructor() {
    this.routes = [];
    window.addEventListener('hashchange', () => this.resolve());
  }

  add(pattern, handler, { auth = false } = {}) {
    const paramNames = [];
    const regexStr = pattern
      .split('/')
      .map((seg) => {
        if (seg.startsWith(':')) {
          paramNames.push(seg.slice(1));
          return '([^/]+)';
        }
        return seg;
      })
      .join('/');
    this.routes.push({ regex: new RegExp(`^${regexStr}$`), paramNames, handler, auth });
    return this;
  }

  resolve() {
    const hash = window.location.hash.replace(/^#/, '') || '/explore';
    const path = hash.split('?')[0];

    for (const route of this.routes) {
      const match = path.match(route.regex);
      if (!match) continue;

      if (route.auth && !api.isAuthenticated()) {
        navigate('/login');
        return;
      }

      const params = {};
      route.paramNames.forEach((name, i) => (params[name] = decodeURIComponent(match[i + 1])));
      renderChrome(path);
      route.handler(document.getElementById('app'), params);
      return;
    }

    navigate('/explore');
  }
}

const router = new Router();

// ---------------------------------------------------------------------
// chrome (top tabs + bottom nav)
// ---------------------------------------------------------------------
function renderChrome(currentPath) {
  const authed = api.isAuthenticated();
  const items = authed
    ? [
        { path: '/explore', label: 'Explore', icon: '&#9968;' },
        { path: '/recommendations', label: 'For You', icon: '&#10024;' },
        { path: '/itineraries', label: 'Trips', icon: '&#128506;' },
        { path: '/profile', label: 'Profile', icon: '&#128100;' },
      ]
    : [
        { path: '/explore', label: 'Explore', icon: '&#9968;' },
        { path: '/login', label: 'Log in', icon: '&#128100;' },
      ];

  const isActive = (p) => currentPath === p || (p === '/explore' && currentPath.startsWith('/destination/'));

  const navHtml = items
    .map(
      (it) => `<a href="#${it.path}" class="nav-item ${isActive(it.path) ? 'active' : ''}">
        <span class="nav-icon">${it.icon}</span><span>${it.label}</span>
      </a>`
    )
    .join('');

  document.getElementById('tabs').innerHTML = navHtml;
  document.getElementById('bottomNav').innerHTML = navHtml;
}

// ---------------------------------------------------------------------
// view: login
// ---------------------------------------------------------------------
function viewLogin(container) {
  container.innerHTML = `
    <div class="auth-shell">
      <h1 class="auth-title">Welcome back</h1>
      <p class="auth-sub">Log in to see your trips and recommendations.</p>
      <form id="loginForm" class="auth-form">
        <label>Email
          <input type="email" name="email" required autocomplete="email">
        </label>
        <label>Password
          <input type="password" name="password" required autocomplete="current-password">
        </label>
        <button type="submit" class="btn btn-primary btn-block">Log in</button>
      </form>
      <p class="auth-switch">No account yet? <a href="#/register">Create one</a></p>
    </div>
  `;

  container.querySelector('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Logging in…';
    try {
      await api.login(form.email.value.trim(), form.password.value);
      navigate('/explore');
      router.resolve();
    } catch (err) {
      showToast(err.message || 'Could not log in', true);
      btn.disabled = false;
      btn.textContent = 'Log in';
    }
  });
}

// ---------------------------------------------------------------------
// view: register
// ---------------------------------------------------------------------
const PREFERENCE_OPTIONS = ['nature', 'history', 'culture', 'food', 'shopping', 'architecture', 'family', 'relaxation'];

function viewRegister(container) {
  container.innerHTML = `
    <div class="auth-shell">
      <h1 class="auth-title">Create your account</h1>
      <p class="auth-sub">Tell us what you're into — it shapes your recommendations.</p>
      <form id="registerForm" class="auth-form">
        <label>Name
          <input type="text" name="name" required autocomplete="name">
        </label>
        <label>Email
          <input type="email" name="email" required autocomplete="email">
        </label>
        <label>Password
          <input type="password" name="password" required minlength="6" autocomplete="new-password">
        </label>
        <fieldset class="pref-fieldset">
          <legend>Interests</legend>
          <div class="pref-chips">
            ${PREFERENCE_OPTIONS.map(
              (p) => `<label class="chip-check">
                <input type="checkbox" name="preferences" value="${p}"> ${categoryLabel(p) || p}
              </label>`
            ).join('')}
          </div>
        </fieldset>
        <button type="submit" class="btn btn-primary btn-block">Create account</button>
      </form>
      <p class="auth-switch">Already have an account? <a href="#/login">Log in</a></p>
    </div>
  `;

  container.querySelector('#registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button');
    const preferences = Array.from(form.querySelectorAll('input[name="preferences"]:checked')).map((c) => c.value);
    btn.disabled = true;
    btn.textContent = 'Creating account…';
    try {
      await api.register(form.name.value.trim(), form.email.value.trim(), form.password.value, preferences);
      navigate('/explore');
      router.resolve();
    } catch (err) {
      showToast(err.message || 'Could not create account', true);
      btn.disabled = false;
      btn.textContent = 'Create account';
    }
  });
}

// ---------------------------------------------------------------------
// destination card (shared by Explore + Recommendations)
// ---------------------------------------------------------------------
function destinationCardHtml(d) {
  const rating = d.avg_rating ? `&#9733; ${d.avg_rating}` : 'No reviews yet';
  const match = d.match_score !== undefined ? `<span class="match-pill">Match ${d.match_score}</span>` : '';
  return `
    <a class="dest-card" href="#/destination/${d.id}">
      <div class="dest-card-media" style="background-image:url('${escapeHtml(d.image || '')}')"></div>
      <div class="dest-card-body">
        <div class="dest-card-top">
          <span class="dest-category">${categoryLabel(d.category)}</span>
          ${match}
        </div>
        <h3>${escapeHtml(d.name)}</h3>
        <p class="dest-neighborhood">${escapeHtml(d.neighborhood)}</p>
        <p class="dest-rating">${rating}</p>
      </div>
    </a>
  `;
}

// ---------------------------------------------------------------------
// view: explore
// ---------------------------------------------------------------------
const EXPLORE_CATEGORIES = ['', 'nature', 'market', 'landmark', 'museum', 'sports', 'neighborhood'];

function viewExplore(container) {
  container.innerHTML = `
    <div class="page-head">
      <h1>Explore Yaoundé</h1>
      <p>Search across the seven hills for places to go.</p>
    </div>
    <div class="explore-controls">
      <input type="search" id="searchInput" placeholder="Search destinations…" class="search-input">
      <div class="category-pills" id="categoryPills">
        ${EXPLORE_CATEGORIES.map(
          (c) => `<button class="pill" data-cat="${c}">${c ? categoryLabel(c) : 'All'}</button>`
        ).join('')}
      </div>
    </div>
    <div id="results" class="dest-grid"><p class="muted">Loading…</p></div>
  `;

  let query = '';
  let category = '';
  let debounceTimer;

  const pills = container.querySelectorAll('.pill');
  const setActivePill = () => {
    pills.forEach((p) => p.classList.toggle('active', p.dataset.cat === category));
  };
  setActivePill();

  async function reload() {
    const resultsEl = container.querySelector('#results');
    resultsEl.innerHTML = '<p class="muted">Loading…</p>';
    try {
      const destinations = await api.searchDestinations(query, category);
      resultsEl.innerHTML = destinations.length
        ? destinations.map(destinationCardHtml).join('')
        : '<p class="muted">No destinations match that search.</p>';
    } catch (err) {
      resultsEl.innerHTML = `<p class="muted">Could not load destinations: ${escapeHtml(err.message)}</p>`;
    }
  }

  container.querySelector('#searchInput').addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    query = e.target.value;
    debounceTimer = setTimeout(reload, 350);
  });

  pills.forEach((pill) => {
    pill.addEventListener('click', () => {
      category = pill.dataset.cat;
      setActivePill();
      reload();
    });
  });

  reload();
}

// ---------------------------------------------------------------------
// view: recommendations
// ---------------------------------------------------------------------
function viewRecommendations(container) {
  container.innerHTML = `
    <div class="page-head">
      <h1>For you</h1>
      <p>Ranked from your interests and what's already in your trips.</p>
    </div>
    <div id="recResults" class="dest-grid"><p class="muted">Loading…</p></div>
  `;

  api.getRecommendations()
    .then((destinations) => {
      const el = container.querySelector('#recResults');
      el.innerHTML = destinations.length
        ? destinations.map(destinationCardHtml).join('')
        : '<p class="muted">Add some interests in your profile to get tailored picks.</p>';
    })
    .catch((err) => {
      container.querySelector('#recResults').innerHTML =
        `<p class="muted">Could not load recommendations: ${escapeHtml(err.message)}</p>`;
    });
}

// ---------------------------------------------------------------------
// view: destination detail (map + route + reviews)
// ---------------------------------------------------------------------
function viewDestination(container, { id }) {
  container.innerHTML = `<p class="muted">Loading…</p>`;

  api.getDestination(id)
    .then((d) => {
      const reviewsHtml = (d.reviews || []).length
        ? d.reviews
            .map(
              (r) => `<div class="review">
                <div class="review-top"><strong>${escapeHtml(r.user_name)}</strong><span>&#9733; ${r.rating}</span></div>
                <p>${escapeHtml(r.comment)}</p>
              </div>`
            )
            .join('')
        : '<p class="muted">No reviews yet — be the first.</p>';

      container.innerHTML = `
        <a class="back-link" href="#/explore">&larr; Back to Explore</a>
        <div class="dest-detail">
          <div class="dest-detail-media" style="background-image:url('${escapeHtml(d.image || '')}')"></div>
          <div class="dest-detail-body">
            <span class="dest-category">${categoryLabel(d.category)}</span>
            <h1>${escapeHtml(d.name)}</h1>
            <p class="dest-neighborhood">${escapeHtml(d.neighborhood)}</p>
            <p>${escapeHtml(d.description)}</p>
            <div class="tag-row">${(d.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>

            <div id="mapWrap" class="map-wrap"><div id="map"></div><p id="routeInfo" class="route-info"></p></div>

            ${api.isAuthenticated() ? `
              <button class="btn btn-ghost" id="addStopBtn">Add to a trip</button>
            ` : ''}

            <h2 class="section-title">Reviews</h2>
            <div id="reviewsList">${reviewsHtml}</div>

            ${api.isAuthenticated() ? `
              <form id="reviewForm" class="review-form">
                <h3>Leave a review</h3>
                <label>Rating
                  <select name="rating" required>
                    <option value="5">5 — Excellent</option>
                    <option value="4">4 — Good</option>
                    <option value="3">3 — Okay</option>
                    <option value="2">2 — Not great</option>
                    <option value="1">1 — Poor</option>
                  </select>
                </label>
                <label>Comment
                  <textarea name="comment" rows="3" placeholder="What was it like?"></textarea>
                </label>
                <button type="submit" class="btn btn-primary">Post review</button>
              </form>
            ` : `<p class="muted"><a href="#/login">Log in</a> to leave a review.</p>`}
          </div>
        </div>
      `;

      if (d.location) {
        try {
          initMap(container, d);
        } catch (mapErr) {
          const mapWrap = container.querySelector('#mapWrap');
          if (mapWrap) mapWrap.innerHTML = '<p class="muted">Map unavailable right now.</p>';
        }
      }

      const reviewForm = container.querySelector('#reviewForm');
      if (reviewForm) {
        reviewForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const btn = reviewForm.querySelector('button');
          btn.disabled = true;
          try {
            await api.addReview(id, Number(reviewForm.rating.value), reviewForm.comment.value.trim());
            showToast('Review posted');
            viewDestination(container, { id });
          } catch (err) {
            showToast(err.message || 'Could not post review', true);
            btn.disabled = false;
          }
        });
      }

      const addStopBtn = container.querySelector('#addStopBtn');
      if (addStopBtn) {
        addStopBtn.addEventListener('click', () => {
          navigate(`/itineraries/new?destination=${encodeURIComponent(id)}`);
        });
      }
    })
    .catch((err) => {
      container.innerHTML = `<p class="muted">Could not load this destination: ${escapeHtml(err.message)}</p>`;
    });
}

function initMap(container, destination) {
  const mapEl = container.querySelector('#map');
  const routeInfoEl = container.querySelector('#routeInfo');
  const destLatLng = [destination.location.lat, destination.location.lng];

  const map = L.map(mapEl).setView(destLatLng, 14);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);

  const destIcon = L.divIcon({ className: 'pin-dest', html: '&#128205;', iconSize: [26, 26] });
  L.marker(destLatLng, { icon: destIcon }).addTo(map);

  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const origin = [pos.coords.latitude, pos.coords.longitude];
      const userIcon = L.divIcon({ className: 'pin-user', html: '' });
      L.marker(origin, { icon: userIcon }).addTo(map);

      routeInfoEl.textContent = 'Finding route…';
      try {
        // OSRM — free, OpenStreetMap-based routing, no API key.
        const url = `https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${destLatLng[1]},${destLatLng[0]}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const body = await res.json();
        if (body.code !== 'Ok' || !body.routes?.length) {
          routeInfoEl.textContent = '';
          return;
        }
        const route = body.routes[0];
        const latlngs = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        const line = L.polyline(latlngs, { color: '#F2814B', weight: 4 }).addTo(map);
        map.fitBounds(line.getBounds(), { padding: [24, 24] });

        const km = (route.distance / 1000).toFixed(1);
        const mins = Math.round(route.duration / 60);
        routeInfoEl.textContent = `${km} km · ${mins} min by road`;
      } catch (_) {
        routeInfoEl.textContent = '';
      }
    },
    () => {
      /* location denied/unavailable — just show the destination pin */
    }
  );
}

// ---------------------------------------------------------------------
// view: itineraries list
// ---------------------------------------------------------------------
function itineraryCardHtml(it, isShared = false) {
  const stopCount = (it.stops || []).length;
  return `
    <a class="itinerary-card" href="#/itineraries/${it.id}">
      <h3>${escapeHtml(it.title)}</h3>
      <p class="muted">${stopCount} stop${stopCount === 1 ? '' : 's'}${isShared ? ' · shared with you' : ''}</p>
      ${it.notes ? `<p class="itinerary-notes">${escapeHtml(it.notes)}</p>` : ''}
    </a>
  `;
}

function viewItineraries(container) {
  container.innerHTML = `
    <div class="page-head page-head-row">
      <div>
        <h1>Your trips</h1>
        <p>Itineraries you've planned, and ones shared with you.</p>
      </div>
      <a href="#/itineraries/new" class="btn btn-primary">New itinerary</a>
    </div>
    <div id="itineraryResults"><p class="muted">Loading…</p></div>
  `;

  api.listItineraries()
    .then(({ itineraries, shared_with_me }) => {
      const el = container.querySelector('#itineraryResults');
      const mineHtml = itineraries.length
        ? `<div class="itinerary-grid">${itineraries.map((i) => itineraryCardHtml(i)).join('')}</div>`
        : '<p class="muted">No itineraries yet — start one from a destination or the button above.</p>';
      const sharedHtml = shared_with_me.length
        ? `<h2 class="section-title">Shared with you</h2><div class="itinerary-grid">${shared_with_me
            .map((i) => itineraryCardHtml(i, true))
            .join('')}</div>`
        : '';
      el.innerHTML = mineHtml + sharedHtml;
    })
    .catch((err) => {
      container.querySelector('#itineraryResults').innerHTML =
        `<p class="muted">Could not load your trips: ${escapeHtml(err.message)}</p>`;
    });
}

// ---------------------------------------------------------------------
// view: create itinerary
// ---------------------------------------------------------------------
function viewCreateItinerary(container) {
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const prefillDestination = params.get('destination') || '';

  container.innerHTML = `
    <a class="back-link" href="#/itineraries">&larr; Back to trips</a>
    <div class="page-head"><h1>New itinerary</h1></div>
    <form id="createForm" class="stacked-form">
      <label>Title
        <input type="text" name="title" required placeholder="e.g. Weekend in Yaoundé">
      </label>
      <label>Notes
        <textarea name="notes" rows="2" placeholder="Optional notes"></textarea>
      </label>
      <label>First stop — destination ID
        <input type="text" name="destinationId" value="${escapeHtml(prefillDestination)}" placeholder="e.g. d001 (find IDs on Explore)">
      </label>
      <button type="submit" class="btn btn-primary">Create itinerary</button>
    </form>
  `;

  container.querySelector('#createForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button');
    btn.disabled = true;
    const stops = form.destinationId.value.trim()
      ? [{ destination_id: form.destinationId.value.trim(), day: 1 }]
      : [];
    try {
      const created = await api.createItinerary({ title: form.title.value.trim(), notes: form.notes.value.trim(), stops });
      showToast('Itinerary created');
      navigate(`/itineraries/${created.id}`);
      router.resolve();
    } catch (err) {
      showToast(err.message || 'Could not create itinerary', true);
      btn.disabled = false;
    }
  });
}

// ---------------------------------------------------------------------
// view: itinerary detail
// ---------------------------------------------------------------------
function viewItineraryDetail(container, { id }) {
  container.innerHTML = `<p class="muted">Loading…</p>`;

  api.getItinerary(id)
    .then((it) => {
      const stopsHtml = (it.stops || []).length
        ? `<ul class="stop-list">${it.stops
            .map((s) => `<li>Day ${escapeHtml(s.day)} — <a href="#/destination/${escapeHtml(s.destination_id)}">${escapeHtml(s.destination_id)}</a>${s.note ? ` — ${escapeHtml(s.note)}` : ''}</li>`)
            .join('')}</ul>`
        : '<p class="muted">No stops yet.</p>';

      container.innerHTML = `
        <a class="back-link" href="#/itineraries">&larr; Back to trips</a>
        <div class="page-head"><h1>${escapeHtml(it.title)}</h1></div>
        ${it.notes ? `<p>${escapeHtml(it.notes)}</p>` : ''}
        <h2 class="section-title">Stops</h2>
        ${stopsHtml}

        <h2 class="section-title">Share</h2>
        <form id="shareForm" class="inline-form">
          <input type="email" name="email" placeholder="friend@email.com" required>
          <button type="submit" class="btn btn-ghost">Share</button>
        </form>
        <div id="sharedWithList" class="tag-row">
          ${(it.shared_with || []).map((e) => `<span class="tag">${escapeHtml(e)}</span>`).join('')}
        </div>

        <button class="btn btn-danger" id="deleteBtn">Delete itinerary</button>
      `;

      container.querySelector('#shareForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        try {
          const updated = await api.shareItinerary(id, form.email.value.trim());
          showToast('Shared');
          container.querySelector('#sharedWithList').innerHTML = (updated.shared_with || [])
            .map((em) => `<span class="tag">${escapeHtml(em)}</span>`)
            .join('');
          form.reset();
        } catch (err) {
          showToast(err.message || 'Could not share', true);
        }
      });

      container.querySelector('#deleteBtn').addEventListener('click', async () => {
        if (!confirm('Delete this itinerary? This cannot be undone.')) return;
        try {
          await api.deleteItinerary(id);
          showToast('Itinerary deleted');
          navigate('/itineraries');
          router.resolve();
        } catch (err) {
          showToast(err.message || 'Could not delete', true);
        }
      });
    })
    .catch((err) => {
      container.innerHTML = `<p class="muted">Could not load this itinerary: ${escapeHtml(err.message)}</p>`;
    });
}

// ---------------------------------------------------------------------
// view: profile
// ---------------------------------------------------------------------
function viewProfile(container) {
  const user = api.currentUser || {};
  container.innerHTML = `
    <div class="page-head"><h1>Profile</h1></div>
    <div class="profile-card">
      <div class="avatar">${escapeHtml((user.name || '?')[0] || '?').toUpperCase()}</div>
      <div>
        <h2>${escapeHtml(user.name || '')}</h2>
        <p class="muted">${escapeHtml(user.email || '')}</p>
      </div>
    </div>
    <h2 class="section-title">Interests</h2>
    <div class="tag-row">${(user.preferences || []).map((p) => `<span class="tag">${escapeHtml(p)}</span>`).join('') || '<span class="muted">None set</span>'}</div>

    <h2 class="section-title">System status</h2>
    <div id="statusPanel" class="status-panel"><p class="muted">Checking…</p></div>

    <button class="btn btn-ghost" id="logoutBtn" style="margin-top:24px;">Log out</button>
  `;

  api.getSystemHealth()
    .then((status) => {
      const rows = Object.entries(status.services || {})
        .map(
          ([name, state]) => `<div class="status-row">
            <span class="status-dot status-${state}"></span>
            <span>${escapeHtml(name)}</span>
            <span class="muted status-state">${escapeHtml(state)}</span>
          </div>`
        )
        .join('');
      container.querySelector('#statusPanel').innerHTML = rows || '<p class="muted">No service data.</p>';
    })
    .catch(() => {
      container.querySelector('#statusPanel').innerHTML = '<p class="muted">Could not reach the gateway.</p>';
    });

  container.querySelector('#logoutBtn').addEventListener('click', () => {
    api.logout();
    navigate('/login');
    router.resolve();
  });
}

// ---------------------------------------------------------------------
// wire up routes and boot
// ---------------------------------------------------------------------
router
  .add('/login', viewLogin)
  .add('/register', viewRegister)
  .add('/explore', viewExplore)
  .add('/destination/:id', viewDestination)
  .add('/recommendations', viewRecommendations, { auth: true })
  .add('/itineraries', viewItineraries, { auth: true })
  .add('/itineraries/new', viewCreateItinerary, { auth: true })
  .add('/itineraries/:id', viewItineraryDetail, { auth: true })
  .add('/profile', viewProfile, { auth: true });

router.resolve();
