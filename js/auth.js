'use strict';

const Auth = {
  login(email, password) {
    const user = DB.getUserByEmail(email);
    if (!user) return { ok: false, error: 'No account found with this email.' };
    if (user.password !== password) return { ok: false, error: 'Incorrect password.' };
    DB.setSession(user);
    return { ok: true, user };
  },
  logout() {
    DB.clearSession();
    window.location.hash = '#/login';
  },
  getUser() {
    return DB.getSession();
  },
  require(roles) {
    const u = this.getUser();
    if (!u) { window.location.hash = '#/login'; return null; }
    if (roles && !roles.includes(u.role)) { window.location.hash = '#/login'; return null; }
    return u;
  }
};
