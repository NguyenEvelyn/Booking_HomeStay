import { StyleSheet, View } from 'react-native';
import { Text } from './Text.js';
import { colors, font, spacing } from '../theme.js';
import { money } from '../utils/format.js';

// Renders the server quote as-is; nothing here recomputes the price.
export default function PriceSummary({ quote }) {
  const rows = [
    [`Tiền phòng (${quote.nights} đêm × ${quote.quantity} phòng)`, quote.roomAmountBeforeDiscount ?? quote.roomTotal],
    quote.seasonalSurchargeAmount > 0 ? ['Phụ thu mùa cao điểm/ngày lễ', quote.seasonalSurchargeAmount, 'info'] : null,
    quote.extraFee > 0 ? ['Phụ thu khách thêm', quote.extraFee] : null,
    quote.discountAmount > 0 ? [quote.deal ? 'Giảm giá deal' : quote.promotionCode ? `Khuyến mãi ${quote.promotionCode}` : 'Giảm giá', -quote.discountAmount] : null,
    ['Tạm tính', quote.subtotal],
    quote.taxAmount > 0 ? [`Thuế (${quote.customerTaxPercent}%)`, quote.taxAmount] : null
  ].filter(Boolean);

  return (
    <View style={styles.box}>
      {rows.map(([label, value, kind]) => (
        <View key={label} style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <Text style={[styles.value, value < 0 && { color: colors.success }]}>{kind === 'info' ? `đã gồm ${money(value)}` : `${value < 0 ? '−' : ''}${money(Math.abs(value))}`}</Text>
        </View>
      ))}
      <View style={[styles.row, styles.totalRow]}>
        <Text style={styles.totalLabel}>Tổng cộng</Text>
        <Text style={styles.total}>{money(quote.total)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>{quote.paymentOption === 'Full' ? 'Thanh toán ngay (toàn bộ)' : `Đặt cọc ngay (${Number(quote.depositPercent)}%)`}</Text>
        <Text style={styles.due}>{money(quote.amountDueNow)}</Text>
      </View>
      {quote.paymentOption !== 'Full' && quote.total > quote.amountDueNow
        ? <Text style={styles.note}>Còn lại {money(quote.total - quote.amountDueNow)} thanh toán khi nhận phòng.</Text>
        : null}
      {quote.deal ? <Text style={[styles.note, { color: colors.danger }]}>Giá deal phút chót: đơn không được hoàn tiền khi hủy.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  label: { flex: 1, fontSize: font.body - 1, color: colors.textMuted },
  value: { fontSize: font.body - 1, color: colors.text, fontWeight: '600' },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.xs },
  totalLabel: { fontSize: font.body, fontWeight: '700', color: colors.text },
  total: { fontSize: font.title, fontWeight: '800', color: colors.text },
  due: { fontSize: font.title, fontWeight: '800', color: colors.primary },
  note: { fontSize: font.small, color: colors.textMuted }
});
