/**
 * Thin API client for the GlobeTrotter API Gateway.
 * Mirrors the Flutter app's ApiService one-for-one so both clients
 * stay behaviorally identical against the same backend.
 *
 * Change API_BASE_URL to point at your running gateway:
 * - Same machine:            http://127.0.0.1:5004
 * - Deployed server/domain:  https://<your-gateway-domain>
 */
const API_BASE_URL = window.GLOBETROTTER_API_BASE_URL || 'http://38.242.246.126:5004';

class ApiException extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('gt_token');
    this.currentUser = this._loadUser();
  }

  // -- session -------------------------------------------------------
  _loadUser() {
    const raw = localStorage.getItem('gt_user');
    return raw ? JSON.parse(raw) : null;
  }

  _persistSession(token, user) {
    this.token = token;
    this.currentUser = user;
    localStorage.setItem('gt_token', token);
    localStorage.setItem('gt_user', JSON.stringify(user));
  }

  logout() {
    this.token = null;
    this.currentUser = null;
    localStorage.removeItem('gt_token');
    localStorage.removeItem('gt_user');
  }

  isAuthenticated() {
    return !!this.token;
  }

  // -- low level -------------------------------------------------------
  _headers() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    return headers;
  }

  _url(path, query) {
    const url = new URL(this.baseUrl + path);
    if (query) {
      Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
      });
    }
    return url.toString();
  }

  async _handle(res) {
    let body = null;
    try {
      body = await res.json();
    } catch (_) {
      /* empty body */
    }
    if (!res.ok) {
      const message = (body && body.error) || `Something went wrong (${res.status})`;
      throw new ApiException(message, res.status);
    }
    return body;
  }

  // -- auth -------------------------------------------------------
  async register(name, email, password, preferences = []) {
    const res = await fetch(this._url('/register'), {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({ name, email, password, preferences }),
    });
    const body = await this._handle(res);
    this._persistSession(body.token, body.user);
    return body.user;
  }

  async login(email, password) {
    const res = await fetch(this._url('/login'), {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({ email, password }),
    });
    const body = await this._handle(res);
    this._persistSession(body.token, body.user);
    return body.user;
  }

  // -- destinations -------------------------------------------------------
  async searchDestinations(query = '', category = '') {
    const res = await fetch(this._url('/destinations', { q: query, category }), {
      headers: this._headers(),
    });
    const body = await this._handle(res);
    return body.destinations;
  }

  async getDestination(id) {
    const res = await fetch(this._url(`/destinations/${id}`), { headers: this._headers() });
    return this._handle(res);
  }

  async addReview(destinationId, rating, comment) {
    const res = await fetch(this._url(`/destinations/${destinationId}/reviews`), {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({ rating, comment }),
    });
    return this._handle(res);
  }

  // -- recommendations -------------------------------------------------------
  async getRecommendations() {
    const res = await fetch(this._url('/recommendations'), { headers: this._headers() });
    const body = await this._handle(res);
    return body.recommendations;
  }

  // -- itineraries -------------------------------------------------------
  async listItineraries() {
    const res = await fetch(this._url('/itineraries'), { headers: this._headers() });
    return this._handle(res); // { itineraries, shared_with_me }
  }

  async getItinerary(id) {
    const res = await fetch(this._url(`/itineraries/${id}`), { headers: this._headers() });
    return this._handle(res);
  }

  async createItinerary({ title, notes = '', startDate = null, endDate = null, stops = [] }) {
    const res = await fetch(this._url('/itineraries'), {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({ title, notes, start_date: startDate, end_date: endDate, stops }),
    });
    return this._handle(res);
  }

  async updateItinerary(id, changes) {
    const res = await fetch(this._url(`/itineraries/${id}`), {
      method: 'PUT',
      headers: this._headers(),
      body: JSON.stringify(changes),
    });
    return this._handle(res);
  }

  async deleteItinerary(id) {
    const res = await fetch(this._url(`/itineraries/${id}`), {
      method: 'DELETE',
      headers: this._headers(),
    });
    return this._handle(res);
  }

  async shareItinerary(id, email) {
    const res = await fetch(this._url(`/itineraries/${id}/share`), {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({ email }),
    });
    return this._handle(res);
  }

  // -- system -------------------------------------------------------
  async getSystemHealth() {
    const res = await fetch(this._url('/health'), { headers: this._headers() });
    return this._handle(res);
  }
}

const api = new ApiClient(API_BASE_URL);
