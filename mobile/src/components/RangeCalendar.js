import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text.js';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, font, radius, spacing } from '../theme.js';
import { toIsoDate } from '../utils/dates.js';

const WEEK_HEADER = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

// Month grid for picking check-in then check-out, like booking apps: the first tap sets check-in, the
// second (a later day) sets check-out; tapping again starts over. Past days are disabled.
export default function RangeCalendar({ checkIn, checkOut, onChange }) {
  const today = toIsoDate(new Date());
  const [month, setMonth] = useState(() => {
    const base = checkIn ? new Date(`${checkIn}T00:00:00`) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const isCurrentMonth = month.getFullYear() === new Date().getFullYear() && month.getMonth() === new Date().getMonth();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leadingBlanks = (month.getDay() + 6) % 7; // weeks start on Monday
  const cells = [...Array(leadingBlanks).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => toIsoDate(new Date(month.getFullYear(), month.getMonth(), i + 1)))];

  const pick = (day) => {
    if (!checkIn || checkOut || day <= checkIn) onChange({ checkIn: day, checkOut: '' });
    else onChange({ checkIn, checkOut: day });
  };

  return (
    <View>
      <View style={styles.header}>
        <Pressable onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} disabled={isCurrentMonth} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={isCurrentMonth ? colors.border : colors.navy} />
        </Pressable>
        <Text style={styles.monthTitle}>Tháng {month.getMonth() + 1}/{month.getFullYear()}</Text>
        <Pressable onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} hitSlop={10}>
          <Ionicons name="chevron-forward" size={22} color={colors.navy} />
        </Pressable>
      </View>
      <View style={styles.grid}>
        {WEEK_HEADER.map(d => <Text key={d} style={[styles.cell, styles.weekday]}>{d}</Text>)}
        {cells.map((day, index) => {
          if (!day) return <View key={`blank-${index}`} style={styles.cell} />;
          const past = day < today;
          const edge = day === checkIn || day === checkOut;
          const between = checkIn && checkOut && day > checkIn && day < checkOut;
          return (
            <Pressable key={day} style={styles.cell} disabled={past} onPress={() => pick(day)}>
              <View style={[styles.day, between && styles.between, edge && styles.edge]}>
                <Text style={[styles.dayText, past && styles.past, between && { color: colors.navy }, edge && styles.edgeText]}>
                  {Number(day.slice(8))}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  monthTitle: { fontSize: font.body + 1, fontWeight: '700', color: colors.navy },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2 },
  weekday: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textAlign: 'center', textAlignVertical: 'center', aspectRatio: 1.6 },
  day: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  between: { backgroundColor: '#e3ebfd' },
  edge: { backgroundColor: colors.primary },
  dayText: { fontSize: font.body, color: colors.text },
  edgeText: { color: '#fff', fontWeight: '700' },
  past: { color: colors.border }
});
