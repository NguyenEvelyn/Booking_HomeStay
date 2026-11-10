import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

// Opens the VNPay page in an in-app browser. The backend records the result on its return URL, so when the
// guest closes the browser the app simply re-reads the booking status instead of parsing a redirect.
export async function openPayment(paymentUrl) {
  if (Platform.OS === 'web') {
    window.open(paymentUrl, '_blank', 'noopener');
    return;
  }
  await WebBrowser.openBrowserAsync(paymentUrl, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
}
