import { Redirect } from 'expo-router';

// The Predictions tab opens Atlas Predictions over the tabs (see the tab bar); a visit to this
// address goes there too.
export default function PredictionsTab() {
  return <Redirect href="/predictions" />;
}
