import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { homeApi } from '../../api/homeApi.js';
import HomeHero from '../../components/home/HomeHero.js';
import SearchPanel from '../../components/home/SearchPanel.js';
import About from '../../components/home/About.js';
import HotDeals from '../../components/home/HotDeals.js';
import StaySlider from '../../components/home/StaySlider.js';
import Destinations from '../../components/home/Destinations.js';
import Offers from '../../components/home/Offers.js';
import { colors } from '../../theme.js';

// Mirrors the web home page on a phone: hero with AI picks, search, about, hot deals, favourite
// homestays, trending destinations and vouchers. Every section loads on its own and hides when empty.
export default function HomeScreen() {
  const [picks, setPicks] = useState([]);
  const [picksLoading, setPicksLoading] = useState(true);
  const [stays, setStays] = useState([]);
  const [banners, setBanners] = useState([]);
  const [deals, setDeals] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const items = (promise) => promise.then(r => r.items ?? []).catch(() => []);
    const [picked, rated, b, d, v] = await Promise.all([
      items(homeApi.heroPicks()), items(homeApi.topRated()), items(homeApi.banners()), items(homeApi.deals()), items(homeApi.vouchers())
    ]);
    // Like the web: fall back to the top-rated homestays when the recommender has nothing.
    setPicks(picked.length ? picked : rated.slice(0, 4).map(s => ({ ...s, score: (Number(s.averageRating) || 4.8) * 20 })));
    setPicksLoading(false);
    setStays(rated); setBanners(b); setDeals(d); setVouchers(v);
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#fff" />}
    >
      <HomeHero picks={picks} loading={picksLoading} />
      <SearchPanel />
      <HotDeals banners={banners} deals={deals} />
      <StaySlider stays={stays} />
      <Destinations />
      <Offers vouchers={vouchers} />
      <About />
    </ScrollView>
  );
}
