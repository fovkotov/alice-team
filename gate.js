const AUTH_KEY = 'alice-team-auth';
const PASSWORD = 'alice';

export function isAuthed() {
  return sessionStorage.getItem(AUTH_KEY) === '1';
}

export function requireAuth() {
  if (isAuthed()) return Promise.resolve();

  return new Promise((resolve) => {
    const gate = document.createElement('div');
    gate.className = 'gate';
    gate.innerHTML = `
      <form>
        <input type="password" autocomplete="current-password" placeholder="пароль" autofocus />
        <p class="error" aria-live="polite"></p>
        <button type="submit">войти</button>
      </form>
    `;
    document.body.appendChild(gate);

    const form = gate.querySelector('form');
    const input = gate.querySelector('input');
    const error = gate.querySelector('.error');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (input.value === PASSWORD) {
        sessionStorage.setItem(AUTH_KEY, '1');
        gate.remove();
        resolve();
        return;
      }
      error.textContent = 'неверный пароль';
      input.value = '';
      input.focus();
    });
  });
}
