import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BackHeader, Button, Card, C, Pill, Progress } from '../ui';
export function ModeTemplate({
  navigation,
  tag,
  title,
  accent,
  colors,
  headline,
  copy,
  reward,
  label,
  onAction,
  status,
}: {
  navigation: { goBack: () => void };
  tag: string;
  title: string;
  accent: string;
  colors: [string, string];
  headline: string;
  copy: string;
  reward: string;
  label: string;
  onAction: () => void;
  status: string;
}) {
  return (
    <View style={s.root}>
      <BackHeader
        title={title}
        tag={tag}
        color={accent}
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={s.content}>
        <Card colors={colors} style={s.hero}>
          <Pill color={accent}>{tag}</Pill>
          <Text style={s.headline}>{headline}</Text>
          <Text style={s.copy}>{copy}</Text>
          <View style={s.reward}>
            <Text style={[s.rewardIcon, { color: accent }]}>✦</Text>
            <Text style={s.rewardText}>{reward}</Text>
          </View>
          <Progress value={42} color={accent} />
        </Card>
        <Text style={s.section}>Bugünkü durum</Text>
        <View style={s.info}>
          <Text style={s.infoTitle}>{label}</Text>
          <Text style={s.infoCopy}>{status}</Text>
        </View>
        <Button title={label} color={accent} onPress={onAction} />
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, gap: 16 },
  hero: { padding: 21, minHeight: 285 },
  headline: {
    color: 'white',
    fontWeight: '900',
    fontSize: 28,
    lineHeight: 34,
    marginTop: 20,
  },
  copy: { color: '#DAE0EF', fontSize: 12, lineHeight: 18, marginTop: 10 },
  reward: {
    marginTop: 'auto',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 13,
  },
  rewardIcon: { fontSize: 20 },
  rewardText: { color: '#EBF0FF', fontSize: 11, fontWeight: '700' },
  section: { color: C.text, fontSize: 18, fontWeight: '900', marginTop: 7 },
  info: { backgroundColor: C.surface, padding: 17, borderRadius: 19 },
  infoTitle: { color: C.text, fontWeight: '900', fontSize: 14 },
  infoCopy: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 5 },
});
