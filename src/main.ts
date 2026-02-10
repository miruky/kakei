import './style.css';
import { mountApp } from './app';
import { Ledger } from './lib/ledger';

const root = document.getElementById('app');
if (root !== null) {
  mountApp(root, new Ledger(localStorage));
}

// オフラインでも開けるよう、配信URL基準でService Workerを登録する。
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  });
}
