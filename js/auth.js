import { EDIT_PASSWORD } from './config.js';

let _onSuccess = null;

export function check(password) {
    return password && password.trim().toLowerCase() === EDIT_PASSWORD;
}

export function setCallback(fn) {
    _onSuccess = fn;
}

export function executeCallback() {
    if (typeof _onSuccess === 'function') {
        _onSuccess();
    }
    _onSuccess = null;
}
