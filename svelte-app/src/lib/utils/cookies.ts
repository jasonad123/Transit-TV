/**
 * Simple cookie utilities for config persistence
 * Cookies persist more reliably than localStorage in Chromium kiosk mode
 */

export function setCookie(name: string, value: string, days: number = 365): void {
	try {
		const date = new Date();
		date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
		const expires = `expires=${date.toUTCString()}`;
		document.cookie = `${name}=${encodeURIComponent(value)};${expires};path=/;SameSite=Lax`;
	} catch (e) {
		console.error('Error setting cookie:', e);
	}
}

export function getCookie(name: string): string | null {
	try {
		const nameEQ = `${name}=`;
		const cookies = document.cookie.split(';');

		for (let i = 0; i < cookies.length; i++) {
			let cookie = cookies[i];
			while (cookie.charAt(0) === ' ') {
				cookie = cookie.substring(1);
			}
			if (cookie.indexOf(nameEQ) === 0) {
				return decodeURIComponent(cookie.substring(nameEQ.length));
			}
		}
		return null;
	} catch (e) {
		console.error('Error getting cookie:', e);
		return null;
	}
}

export function deleteCookie(name: string): void {
	try {
		document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
	} catch (e) {
		console.error('Error deleting cookie:', e);
	}
}
