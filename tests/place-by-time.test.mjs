// Friday, as it actually happened: six photographs taken between Barcelos
// and Ponte de Lima, all posted from the albergue at seven in the evening.
import { placeByTime, takenJustNow } from '../src/lib/whenWhere.ts'

const t = (s) => Date.parse(`2026-09-18T${s}:00Z`)
const anchors = [{ km: 61.8, at: t('07:36') }, { km: 81.61, at: t('17:11') }]
const now = t('17:30')
let bad = 0
const ok = (what, cond, note = '') => { if (!cond) bad++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}${note ? ' · ' + note : ''}`) }

for (const [what, at] of [['07:40', t('07:40')], ['10:13', t('10:13')], ['12:30', t('12:30')], ['13:13', t('13:13')]]) {
  const p = placeByTime(anchors, at, now)
  ok(`a photo at ${what} lands on the day's road`, !!p && p.km > 61.8 && p.km < 81.61, p ? `km ${p.km} (${p.how})` : 'nowhere')
}
ok('a picture from two days before the first anchor is left alone', placeByTime(anchors, t('07:36') - 48 * 3600e3, now) === null)
ok('a picture three days after the last is left alone', placeByTime(anchors, t('17:11') + 72 * 3600e3, t('17:11') + 73 * 3600e3) === null)
ok('an hour past the last anchor takes its kilometre', placeByTime(anchors, t('18:11'), t('18:20'))?.km === 81.61)
ok('with no track at all, nothing is invented', placeByTime([], t('10:00'), now) === null)
ok('a clock running ahead is not trusted', placeByTime(anchors, now + 60 * 60e3, now) === null)
ok('a picture taken minutes ago is fresh', takenJustNow(new Date(now - 5 * 60e3).toISOString(), now))
ok('this morning’s picture is not', !takenJustNow(new Date(t('07:40')).toISOString(), now))
ok('a picture with no time at all counts as fresh', takenJustNow(null, now))
process.exit(bad ? 1 : 0)
