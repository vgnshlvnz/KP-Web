/**
 * Nutation, obliquity and sidereal time vs Swiss Ephemeris 2.10.03 (work package `fix-nutation`, #82,
 * which closes engine-mismatch #57).
 *
 * The engine's nutation is the full 77-term IAU 2000B series in `src/engine/nutation.ts`, the model
 * Swiss Ephemeris uses by default. astronomy-engine's `e_tilt` is a 5-term truncation of it that is
 * up to 0.26" off in dPsi (0.13" at the audit instants); that put a horary lagna on a sub start up
 * to 0.13" inside the PREVIOUS sub in Swiss Ephemeris terms.
 *
 * Reference values. Swiss Ephemeris was used only to generate the numbers below (a throw-away venv
 * outside the repo; it is not a dependency). The generating script, run with pyswisseph 2.10.03:
 *
 *   import swisseph as swe, random
 *   row = lambda jd: swe.calc_ut(jd, swe.ECL_NUT, 0)[0]      # true eps, mean eps, dPsi, dEps (degrees)
 *   # YEARLY: jd = swe.julday(y, 1, 1, 0.0) for y in 1900..2100 -> (jd, dPsi*3600, dEps*3600)
 *   # DENSE:  random.seed(57); first 100 of [random.uniform(2415020.5, 2488069.5) for _ in range(3000)]
 *   # AUDIT:  the five instants of audit.md Appendix A -> label, jd, dPsi", dEps", mean eps, true eps, swe.sidtime(jd)
 *   # TT:     swe.calc(jd_et, swe.ECL_NUT, 0)            # same, for a Julian Day in TT (ET)
 *
 * dPsi and dEps are in arcseconds, Julian Days are UT unless the table says TT.
 * Tolerance: 0.001" for dPsi and dEps (the target of #57; measured maximum on the whole set is about
 * 0.0002", mostly the difference between the delta-T of the two libraries away from the present).
 * It is not loosened anywhere.
 */
import { describe, it, expect } from 'vitest';
import * as Astronomy from 'astronomy-engine';
import {
  calculateAyanamsa,
  calculateNutation,
  calculateObliquity,
  calculateSiderealTime,
  normalizeDegrees,
} from '../src/engine/astronomy.js';
import { IAU2000B_TERM_COUNT, nutationIau2000b } from '../src/engine/nutation.js';
import { calculateEphemeris } from '../src/engine/ephemeris.js';
import { calculateChart } from '../src/engine/index.js';
import { NUTATION_MODEL } from '../src/engine/conventions.js';
import type { PlanetName } from '../src/engine/types.js';

const NUTATION_ARCSEC = 0.001;

/** [jd UT, dPsi", dEps"] every 1 January 1900..2100 at 0h UT. */
const YEARLY: ReadonlyArray<readonly [number, number, number]> = [
  [2415020.500000000, 17.4334723, -2.2902508],
  [2415385.500000000, 15.2924093, -5.1610654],
  [2415750.500000000, 11.8325743, -7.4900241],
  [2416115.500000000, 6.9159474, -9.2311247],
  [2416480.500000000, 0.8035743, -9.9090812],
  [2416846.500000000, -5.0020063, -9.3749872],
  [2417211.500000000, -9.9260674, -7.8633876],
  [2417576.500000000, -13.9415063, -5.7076982],
  [2417941.500000000, -16.6072005, -2.8060087],
  [2418307.500000000, -16.7777984, 0.4070385],
  [2418672.500000000, -14.8452572, 3.3697693],
  [2419037.500000000, -11.7560517, 5.7067706],
  [2419402.500000000, -7.6027348, 7.5855291],
  [2419768.500000000, -1.9225834, 8.5835591],
  [2420133.500000000, 4.0682788, 8.4552046],
  [2420498.500000000, 9.0988956, 7.2077966],
  [2420863.500000000, 13.0840226, 5.3587621],
  [2421229.500000000, 16.3544761, 2.8019482],
  [2421594.500000000, 17.8528024, -0.2570976],
  [2421959.500000000, 16.8319192, -3.4539720],
  [2422324.500000000, 13.9627365, -6.1250758],
  [2422690.500000000, 10.0155260, -8.2353715],
  [2423055.500000000, 4.7955746, -9.5827295],
  [2423420.500000000, -1.4408161, -9.8648807],
  [2423785.500000000, -7.1704618, -8.8942044],
  [2424151.500000000, -11.6231801, -7.0398377],
  [2424516.500000000, -14.9574123, -4.6215547],
  [2424881.500000000, -16.9354189, -1.6239111],
  [2425246.500000000, -16.4059188, 1.6058054],
  [2425612.500000000, -13.7341743, 4.4458462],
  [2425977.500000000, -10.0105798, 6.5220737],
  [2426342.500000000, -5.5431652, 8.0283623],
  [2426707.500000000, 0.2515847, 8.6919277],
  [2427073.500000000, 6.2335660, 8.1801671],
  [2427438.500000000, 11.0378179, 6.5606814],
  [2427803.500000000, 14.4422657, 4.3927120],
  [2428168.500000000, 17.0547737, 1.6967501],
  [2428534.500000000, 17.8499608, -1.4383889],
  [2428899.500000000, 16.1281691, -4.5808878],
  [2429264.500000000, 12.4934289, -7.0570736],
  [2429629.500000000, 8.0618165, -8.8300898],
  [2429995.500000000, 2.5922959, -9.7767852],
  [2430360.500000000, -3.6153894, -9.6648359],
  [2430725.500000000, -9.1831516, -8.2966898],
  [2431090.500000000, -13.0966510, -6.1424210],
  [2431456.500000000, -15.6867025, -3.4711763],
  [2431821.500000000, -16.8987392, -0.4320166],
  [2432186.500000000, -15.7815191, 2.7505462],
  [2432551.500000000, -12.4141306, 5.3684280],
  [2432917.500000000, -8.0757776, 7.2114099],
  [2433282.500000000, -3.3032436, 8.3230438],
  [2433647.500000000, 2.3922309, 8.6259468],
  [2434012.500000000, 8.2663958, 7.7006452],
  [2434378.500000000, 12.8144323, 5.7873932],
  [2434743.500000000, 15.6543102, 3.3307757],
  [2435108.500000000, 17.4237747, 0.5215785],
  [2435473.500000000, 17.5095800, -2.6575437],
  [2435839.500000000, 15.1504223, -5.6419436],
  [2436204.500000000, 10.8590452, -7.8860116],
  [2436569.500000000, 5.9012832, -9.2928277],
  [2436934.500000000, 0.2980847, -9.8658812],
  [2437300.500000000, -5.7155214, -9.3004139],
  [2437665.500000000, -11.0046875, -7.5676746],
  [2438030.500000000, -14.3920315, -5.1345280],
  [2438395.500000000, -16.2462637, -2.3407574],
  [2438761.500000000, -16.5716366, 0.7589293],
  [2439126.500000000, -14.8715904, 3.8300349],
  [2439491.500000000, -10.9356700, 6.2203362],
  [2439856.500000000, -6.1603289, 7.7140791],
  [2440222.500000000, -1.0016578, 8.4748106],
  [2440587.500000000, 4.5166036, 8.3953347],
  [2440952.500000000, 10.1278734, 7.1152172],
  [2441317.500000000, 14.2316277, 4.8703541],
  [2441683.500000000, 16.6258712, 2.1979551],
  [2442048.500000000, 17.5136445, -0.6891765],
  [2442413.500000000, 16.8398219, -3.8116500],
  [2442778.500000000, 13.7672377, -6.6344732],
  [2443144.500000000, 9.0528951, -8.5968378],
  [2443509.500000000, 3.6589967, -9.6069026],
  [2443874.500000000, -2.0034269, -9.7514314],
  [2444239.500000000, -7.8537034, -8.7896918],
  [2444605.500000000, -12.5856723, -6.7272410],
  [2444970.500000000, -15.4065694, -4.0446775],
  [2445335.500000000, -16.4978213, -1.1378772],
  [2445700.500000000, -16.1297582, 1.9259395],
  [2446066.500000000, -13.6503902, 4.8222531],
  [2446431.500000000, -9.2599484, 6.9661490],
  [2446796.500000000, -4.0874400, 8.1208251],
  [2447161.500000000, 1.1414476, 8.4959739],
  [2447527.500000000, 6.6341259, 8.0043334],
  [2447892.500000000, 11.8416231, 6.4063157],
  [2448257.500000000, 15.4856874, 3.8856775],
  [2448622.500000000, 17.1842823, 1.0458553],
  [2448988.500000000, 17.3559323, -1.9077535],
  [2449353.500000000, 15.8739442, -4.9124985],
  [2449718.500000000, 12.1976583, -7.5177738],
  [2450083.500000000, 7.0319400, -9.1388108],
  [2450449.500000000, 1.3823795, -9.7518693],
  [2450814.500000000, -4.2917070, -9.4771957],
  [2451179.500000000, -9.7876006, -8.1436786],
  [2451544.500000000, -13.9310579, -5.7599871],
  [2451910.500000000, -16.1314949, -2.8773344],
  [2452275.500000000, -16.4965856, 0.0672261],
  [2452640.500000000, -15.3443938, 3.0309316],
  [2453005.500000000, -12.1711579, 5.7466947],
  [2453371.500000000, -7.4103983, 7.6029154],
  [2453736.500000000, -1.9865809, 8.3805974],
  [2454101.500000000, 3.3320892, 8.3468859],
  [2454466.500000000, 8.7021471, 7.5004446],
  [2454832.500000000, 13.3903406, 5.5862503],
  [2455197.500000000, 16.4486731, 2.8233934],
  [2455562.500000000, 17.4924120, -0.1553460],
  [2455927.500000000, 16.9689503, -3.0891944],
  [2456293.500000000, 14.6559608, -5.9425714],
  [2456658.500000000, 10.3927846, -8.2784496],
  [2457023.500000000, 4.8719569, -9.5405037],
  [2457388.500000000, -0.8488224, -9.7410335],
  [2457754.500000000, -6.4588831, -9.0464077],
  [2458119.500000000, -11.5626991, -7.3618082],
  [2458484.500000000, -15.0880345, -4.7127643],
  [2458849.500000000, -16.4936817, -1.7020253],
  [2459215.500000000, -16.1594028, 1.2647348],
  [2459580.500000000, -14.3425124, 4.0814094],
  [2459945.500000000, -10.5682886, 6.5489955],
  [2460310.500000000, -5.3589617, 8.0670716],
  [2460676.500000000, 0.1981394, 8.5035851],
  [2461041.500000000, 5.4213271, 8.0650020],
  [2461406.500000000, 10.5545933, 6.8397671],
  [2461771.500000000, 14.7937820, 4.6292280],
  [2462137.500000000, 17.1850455, 1.7115202],
  [2462502.500000000, 17.4501425, -1.3537173],
  [2462867.500000000, 16.2189534, -4.2477917],
  [2463232.500000000, 13.2381895, -6.9077248],
  [2463598.500000000, 8.4297088, -8.8945370],
  [2463963.500000000, 2.5726681, -9.7768370],
  [2464328.500000000, -3.1066220, -9.5602125],
  [2464693.500000000, -8.4909937, -8.4951536],
  [2465059.500000000, -13.1140357, -6.4546013],
  [2465424.500000000, -16.0119924, -3.5948636],
  [2465789.500000000, -16.5813393, -0.4715719],
  [2466154.500000000, -15.5887855, 2.3960241],
  [2466520.500000000, -13.0869100, 5.0546571],
  [2466885.500000000, -8.8245410, 7.2353577],
  [2467250.500000000, -3.2039115, 8.4397705],
  [2467615.500000000, 2.3138968, 8.4478523],
  [2467981.500000000, 7.4354608, 7.6397971],
  [2468346.500000000, 12.2088376, 6.0667363],
  [2468711.500000000, 15.9919988, 3.6287072],
  [2469076.500000000, 17.5660363, 0.5337356],
  [2469442.500000000, 17.1132529, -2.5447919],
  [2469807.500000000, 15.1715748, -5.3304540],
  [2470172.500000000, 11.6275497, -7.7196005],
  [2470537.500000000, 6.2541217, -9.3808055],
  [2470903.500000000, 0.2360115, -9.8534810],
  [2471268.500000000, -5.3223901, -9.2146214],
  [2471633.500000000, -10.2839688, -7.7552912],
  [2471998.500000000, -14.4791356, -5.4490979],
  [2472364.500000000, -16.6491623, -2.4254159],
  [2472729.500000000, -16.4192433, 0.7498855],
  [2473094.500000000, -14.6059188, 3.5212527],
  [2473459.500000000, -11.6629700, 5.9473783],
  [2473825.500000000, -6.9444264, 7.8042351],
  [2474190.500000000, -1.0362521, 8.6579672],
  [2474555.500000000, 4.5781612, 8.2749189],
  [2474920.500000000, 9.2945892, 7.1080806],
  [2475286.500000000, 13.6594822, 5.2021348],
  [2475651.500000000, 16.8981133, 2.5486101],
  [2476016.500000000, 17.8307184, -0.6535962],
  [2476381.500000000, 16.4746365, -3.6715682],
  [2476747.500000000, 13.8415849, -6.3150461],
  [2477112.500000000, 9.7974997, -8.4141700],
  [2477477.500000000, 4.1326449, -9.7122155],
  [2477842.500000000, -2.0798318, -9.7400763],
  [2478208.500000000, -7.4658833, -8.7150555],
  [2478573.500000000, -11.8729752, -6.8958795],
  [2478938.500000000, -15.4023543, -4.3706269],
  [2479303.500000000, -16.9651024, -1.2071202],
  [2479669.500000000, -16.0087345, 1.9315386],
  [2480034.500000000, -13.3483078, 4.5718926],
  [2480399.500000000, -9.8324325, 6.7027459],
  [2480764.500000000, -4.9199959, 8.2602987],
  [2481130.500000000, 1.1095396, 8.7079716],
  [2481495.500000000, 6.8004441, 7.9539479],
  [2481860.500000000, 11.2287793, 6.3979994],
  [2482225.500000000, 14.9291144, 4.2680973],
  [2482591.500000000, 17.4891953, 1.4033799],
  [2482956.500000000, 17.8103747, -1.8417299],
  [2483321.500000000, 15.7071384, -4.8054324],
  [2483686.500000000, 12.3182230, -7.1931456],
  [2484052.500000000, 7.7759268, -8.9776100],
  [2484417.500000000, 1.9407100, -9.8775604],
  [2484782.500000000, -4.2898690, -9.5071559],
  [2485147.500000000, -9.4030462, -8.1020746],
  [2485513.500000000, -13.2669536, -5.9331356],
  [2485878.500000000, -16.0645042, -3.2260884],
  [2486243.500000000, -16.9538783, -0.0157357],
  [2486608.500000000, -15.2629268, 3.0177088],
  [2486974.500000000, -11.9013492, 5.5327934],
  [2487339.500000000, -7.8599217, 7.3364894],
  [2487704.500000000, -2.7845960, 8.5205470],
  [2488069.500000000, 3.2893746, 8.5635308],
];

/** [jd UT, dPsi", dEps"] 100 random instants in 1900..2100 (seed 57). */
const DENSE: ReadonlyArray<readonly [number, number, number]> = [
  [2418129.882811494, -16.7334446, -1.0459663],
  [2458096.505515391, -12.0669521, -7.3576519],
  [2416431.135458101, 0.1134411, -9.3175859],
  [2452576.900349161, -17.3295005, 3.2831866],
  [2486363.523612318, -18.0918973, 1.6670097],
  [2436222.738998741, 11.7725224, -7.8064763],
  [2486186.285603607, -18.7013041, 0.1160080],
  [2461481.941078202, 11.6158315, 7.4050710],
  [2479594.872707103, -17.9646744, 1.9892517],
  [2416457.419632676, 0.4471854, -9.8038326],
  [2468758.557940176, 16.7580661, 3.9331113],
  [2452765.225182172, -16.0392902, 4.4784794],
  [2459167.342830552, -18.5928392, 1.3811442],
  [2442631.531395384, 16.0330844, -5.0013228],
  [2486387.428832247, -17.6251169, 1.2895802],
  [2462887.800581143, 16.9860033, -4.2934320],
  [2468023.251642432, 9.2058338, 8.1684516],
  [2464930.290857487, -11.1609454, -6.2327570],
  [2454931.730365495, 12.9180908, 5.8847048],
  [2474439.802237910, 2.4857338, 9.5677694],
  [2460038.307034822, -10.1053072, 8.0844852],
  [2456312.953967198, 14.9333802, -5.8787384],
  [2425205.264112880, -18.2267925, 1.5520673],
  [2455658.520208889, 16.4022722, 0.0831827],
  [2426303.133969671, -7.4581309, 8.0965076],
  [2457848.010799441, -8.7833499, -7.6797005],
  [2446173.941632607, -13.8324643, 6.4112261],
  [2470716.916575679, 3.5719991, -9.7520168],
  [2458080.933125834, -12.6447375, -7.3345588],
  [2441687.647001601, 17.1298449, 2.2087427],
  [2452869.838869937, -12.9730012, 5.5679369],
  [2431072.354033114, -13.8999687, -6.4220333],
  [2486728.010888214, -15.8416100, 4.4349360],
  [2477505.433968125, 4.6411444, -9.3249329],
  [2443898.446443624, -1.8912232, -9.4348387],
  [2430918.969314935, -11.3208811, -7.2222069],
  [2447614.905444300, 7.2709223, 8.5933946],
  [2461648.048251077, 14.0514758, 6.3603150],
  [2447579.167870488, 8.4286446, 8.7226600],
  [2483776.221555752, 10.7343170, -6.7593261],
  [2418726.230202536, -13.7073087, 4.6453020],
  [2439958.095767600, -6.1665768, 9.1894284],
  [2452761.524693179, -16.2141818, 4.6414496],
  [2418350.200050814, -15.9395955, 1.4282555],
  [2449082.368080970, 16.3087547, -1.6284884],
  [2456832.968504173, 7.4802486, -9.0175595],
  [2437219.181896783, -5.8760454, -8.5175807],
  [2487622.920587679, -5.4778439, 9.3367959],
  [2440533.532067048, 1.7342708, 9.0037793],
  [2441889.841407618, 18.0511351, 0.7603876],
  [2458470.887216549, -15.7677913, -4.8367495],
  [2434349.033649566, 10.9011603, 6.0238149],
  [2449438.399067496, 14.3898311, -4.3613731],
  [2426446.758792357, -4.8454869, 9.3298117],
  [2419103.855106233, -10.8500471, 7.1414806],
  [2465051.147010080, -13.1976829, -6.4109886],
  [2435353.140056655, 17.8653808, -0.6007849],
  [2426772.680768494, 1.9777766, 9.6670151],
  [2433865.452017164, 6.5164193, 8.7334389],
  [2445433.712153892, -17.6615211, 0.7951370],
  [2425747.398526708, -13.9567639, 5.6332168],
  [2465792.795006341, -16.7384214, -0.4577387],
  [2467776.477977977, 3.6941901, 8.2202430],
  [2485890.462796980, -15.9255940, -2.9447100],
  [2418135.176207472, -16.4289218, -1.1299986],
  [2438046.218232221, -14.0547221, -4.8077631],
  [2464178.008217282, 0.0293680, -9.2703564],
  [2476767.436250570, 14.5334451, -6.3193393],
  [2433095.277616466, -5.8994292, 7.8265002],
  [2478336.976951103, -11.0869867, -7.8488871],
  [2418088.780056179, -18.1345254, -1.2860358],
  [2455007.213392245, 14.8919081, 4.2679183],
  [2416780.051777689, -5.8464060, -8.7955161],
  [2426619.207654253, -2.0948139, 9.4941025],
  [2467250.344210496, -3.1974387, 8.4341162],
  [2447658.213384551, 7.3955386, 7.8641631],
  [2481532.596251016, 7.6707808, 8.4274783],
  [2483591.150992010, 12.5531747, -5.5099331],
  [2447634.379062347, 7.0405897, 8.5150162],
  [2453950.466437708, 1.5391138, 9.0016066],
  [2442664.775975792, 14.6516424, -4.6922911],
  [2427181.455458962, 6.4583648, 8.6372866],
  [2445592.482534674, -16.6319652, 2.1030158],
  [2473234.663388517, -15.0702855, 4.9185356],
  [2445102.995734480, -17.6968451, -2.7169306],
  [2473763.398929851, -9.3956346, 8.0765827],
  [2424900.193837219, -15.7252789, -1.1814789],
  [2422913.185000536, 7.4842404, -8.6301435],
  [2486630.828903767, -14.4556059, 3.3136491],
  [2432035.646556662, -15.5929400, 1.9794824],
  [2425457.598009496, -14.4393454, 3.4739791],
  [2479738.990259145, -15.8330045, 3.5602660],
  [2470180.994772512, 11.5275883, -7.7793568],
  [2479394.474968831, -17.3814232, 0.6201544],
  [2478161.264534591, -8.5127682, -8.6727388],
  [2423886.292967604, -9.6402700, -7.6329513],
  [2456985.407848868, 3.8125735, -9.2758833],
  [2461996.501085103, 16.7132805, 3.5416423],
  [2434377.454567537, 12.6697460, 5.7592519],
  [2459195.500434843, -17.6186751, 1.1737669],
];

/**
 * The five instants of audit.md Appendix A: [label, jd UT, dPsi", dEps", mean obliquity deg,
 * true obliquity deg, Greenwich apparent sidereal time hours].
 */
const AUDIT: ReadonlyArray<readonly [string, number, number, number, number, number, number]> = [
  ['KL 1992', 2448692.426388889, 17.4324920, 1.5303016, 23.440295530773, 23.440720614551, 9.488893727093],
  ['Greenwich 2000', 2451545.000000000, -13.9315236, -5.7698203, 23.439279443904, 23.437676716055, 18.697138162535],
  ['Chennai 1950', 2433448.270486111, -1.2657342, 8.4409685, 23.445725424784, 23.448070138257, 12.056109925807],
  ['Petaling Jaya 2026', 2461365.541666667, 8.1737332, 7.3589614, 23.435781372063, 23.437825528014, 5.003582790808],
  ['Tromso 2010', 2455551.625000000, 17.0466165, -0.1268675, 23.437852283303, 23.437817042341, 8.972289424923],
];

/** [jd TT, dPsi", dEps"] from `swe.calc(jd, ECL_NUT)`: the series itself, with no UT -> TT step. */
const TT: ReadonlyArray<readonly [number, number, number]> = [
  [2451545.0, -13.9315289, -5.7698051],
  [2415020.5, 17.4334763, -2.2902505],
  [2488069.5, 3.2893999, 8.5634795],
  [2433282.5, -3.3032788, 8.3230548],
];

/** UTC instants of the AUDIT rows, same order. */
const AUDIT_UTC = [
  '1992-03-10T22:14:00Z',
  '2000-01-01T12:00:00Z',
  '1950-06-15T18:29:30Z',
  '2026-11-21T01:00:00Z',
  '2010-12-21T03:00:00Z',
] as const;

/** Appendix A true and mean ayanamsa (Swiss Ephemeris 2.10.03), same order. */
const AUDIT_AYANAMSA: ReadonlyArray<Record<'kp_old' | 'kp_new', { mean: number; true: number }>> = [
  { kp_old: { mean: 23.65114606, true: 23.65598842 }, kp_new: { mean: 23.6712715, true: 23.67611386 } },
  { kp_old: { mean: 23.76024004, true: 23.75637017 }, kp_new: { mean: 23.78036498, true: 23.77649512 } },
  { kp_old: { mean: 23.06821122, true: 23.06785963 }, kp_new: { mean: 23.08833912, true: 23.08798753 } },
  { kp_old: { mean: 24.13584602, true: 24.1381165 }, kp_new: { mean: 24.15596915, true: 24.15823963 } },
  { kp_old: { mean: 23.91347595, true: 23.91821112 }, kp_new: { mean: 23.93360017, true: 23.93833535 } },
];

describe('IAU 2000B nutation vs Swiss Ephemeris (#57)', () => {
  it('uses the full 77-term series, not a truncation of it', () => {
    expect(IAU2000B_TERM_COUNT).toBe(77);
    expect(NUTATION_MODEL).toBe('iau2000b_77_terms');
  });

  it(`yearly grid 1900..2100: dPsi and dEps within ${NUTATION_ARCSEC}"`, () => {
    expect(YEARLY.length).toBe(201);
    for (const [jd, dPsi, dEps] of YEARLY) {
      const n = calculateNutation(jd);
      expect(Math.abs(n.dPsi * 3600 - dPsi), `dPsi at JD ${jd}`).toBeLessThanOrEqual(NUTATION_ARCSEC);
      expect(Math.abs(n.dEps * 3600 - dEps), `dEps at JD ${jd}`).toBeLessThanOrEqual(NUTATION_ARCSEC);
    }
  });

  it(`100 random instants 1900..2100: dPsi and dEps within ${NUTATION_ARCSEC}"`, () => {
    expect(DENSE.length).toBe(100);
    for (const [jd, dPsi, dEps] of DENSE) {
      const n = calculateNutation(jd);
      expect(Math.abs(n.dPsi * 3600 - dPsi), `dPsi at JD ${jd}`).toBeLessThanOrEqual(NUTATION_ARCSEC);
      expect(Math.abs(n.dEps * 3600 - dEps), `dEps at JD ${jd}`).toBeLessThanOrEqual(NUTATION_ARCSEC);
    }
  });

  it('the five audit instants agree to 0.0005" (Appendix A header dPsi values)', () => {
    for (const [label, jd, dPsi, dEps] of AUDIT) {
      const n = calculateNutation(jd);
      expect(Math.abs(n.dPsi * 3600 - dPsi), `${label} dPsi`).toBeLessThanOrEqual(0.0005);
      expect(Math.abs(n.dEps * 3600 - dEps), `${label} dEps`).toBeLessThanOrEqual(0.0005);
    }
  });

  it('the series itself, evaluated at a TT Julian Day, agrees with swe.calc', () => {
    for (const [jdTt, dPsi, dEps] of TT) {
      const n = nutationIau2000b(jdTt);
      expect(Math.abs(n.dPsiArcsec - dPsi), `dPsi at JD(TT) ${jdTt}`).toBeLessThanOrEqual(NUTATION_ARCSEC);
      expect(Math.abs(n.dEpsArcsec - dEps), `dEps at JD(TT) ${jdTt}`).toBeLessThanOrEqual(NUTATION_ARCSEC);
    }
  });

  it('rejects a non-finite Julian Day', () => {
    expect(() => nutationIau2000b(NaN)).toThrow(RangeError);
    expect(() => nutationIau2000b(Infinity)).toThrow(RangeError);
  });

  it('is not the astronomy-engine value: it differs from e_tilt by about 0.13" at KL 1992 (#57)', () => {
    const [, jd, dPsi] = AUDIT[0];
    const ae = Astronomy.e_tilt(new Astronomy.AstroTime(jd - 2451545.0)).dpsi;
    expect(Math.abs(ae - dPsi)).toBeGreaterThan(0.1); // the old error
    expect(Math.abs(calculateNutation(jd).dPsi * 3600 - dPsi)).toBeLessThan(0.001); // the new one
  });
});

describe('obliquity and sidereal time with that nutation', () => {
  it('mean and true obliquity agree with Swiss Ephemeris to 0.001" at the audit instants', () => {
    for (const [label, jd, , , meanEps, trueEps] of AUDIT) {
      const n = calculateNutation(jd);
      const o = calculateObliquity(jd, n.dEps);
      expect(Math.abs(o.meanObliquity - meanEps) * 3600, `${label} mean`).toBeLessThanOrEqual(0.001);
      expect(Math.abs(o.trueObliquity - trueEps) * 3600, `${label} true`).toBeLessThanOrEqual(0.001);
    }
  });

  it('GAST = GMST + dPsi cos(true obliquity) agrees with swe.sidtime to 0.005" at the audit instants', () => {
    // The remainder (about 0.0027" at most) is the complementary terms of the equation of the
    // equinoxes, which Swiss Ephemeris adds and this engine does not.
    for (const [label, jd, , , , , gastHours] of AUDIT) {
      const n = calculateNutation(jd);
      const o = calculateObliquity(jd, n.dEps);
      const st = calculateSiderealTime(jd, 0, n.dPsi, o.trueObliquity);
      let d = st.gastDegrees - gastHours * 15;
      d = ((((d + 180) % 360) + 360) % 360) - 180;
      expect(Math.abs(d) * 3600, label).toBeLessThanOrEqual(0.005);
    }
  });

  it('GMST is the same as astronomy-engine GAST minus its equation of the equinoxes, to 1e-9 deg', () => {
    // The previous construction. The new GMST does not call astronomy-engine nutation at all.
    for (const [, jd] of AUDIT) {
      const t = new Astronomy.AstroTime(jd - 2451545.0);
      const old = normalizeDegrees((Astronomy.SiderealTime(t) - Astronomy.e_tilt(t).ee / 3600.0) * 15.0);
      const now = calculateSiderealTime(jd, 0).gmstDegrees;
      let d = now - old;
      d = ((((d + 180) % 360) + 360) % 360) - 180;
      expect(Math.abs(d)).toBeLessThan(1e-9);
    }
  });
});

describe('one nutation everywhere: the ephemeris, ayanamsa, obliquity and chart (#57)', () => {
  AUDIT.forEach(([label, jd, dPsi, dEps, , trueEps], i) => {
    const utc = AUDIT_UTC[i];

    it(`${label}: the ephemeris reports calculateNutation, within 0.001" of Swiss Ephemeris`, () => {
      const r = calculateEphemeris(new Date(utc), { ayanamsa: 'kp_old' });
      const n = calculateNutation(r.julianDayUt);
      expect(r.nutationInLongitudeDeg).toBeCloseTo(n.dPsi, 12);
      expect(r.nutationInObliquityDeg).toBeCloseTo(n.dEps, 12);
      expect(Math.abs(r.nutationInLongitudeDeg * 3600 - dPsi)).toBeLessThanOrEqual(0.001);
      expect(Math.abs(r.nutationInObliquityDeg * 3600 - dEps)).toBeLessThanOrEqual(0.001);
      expect(Math.abs(r.trueObliquityDeg - trueEps) * 3600).toBeLessThanOrEqual(0.001);
      expect(r.trueObliquityDeg - r.meanObliquityDeg).toBeCloseTo(r.nutationInObliquityDeg, 12);
      expect(Math.abs(r.julianDayUt - jd)).toBeLessThan(1e-8);
    });

    for (const mode of ['kp_old', 'kp_new'] as const) {
      it(`${label} ${mode}: true ayanamsa = mean + dPsi, within 0.001" of Swiss Ephemeris`, () => {
        const r = calculateEphemeris(new Date(utc), { ayanamsa: mode });
        const se = AUDIT_AYANAMSA[i][mode];
        expect(r.trueAyanamsaDeg - r.meanAyanamsaDeg).toBeCloseTo(r.nutationInLongitudeDeg, 12);
        expect(Math.abs(r.trueAyanamsaDeg - se.true) * 3600).toBeLessThanOrEqual(0.001);
        expect(Math.abs(r.meanAyanamsaDeg - se.mean) * 3600).toBeLessThanOrEqual(0.001);
      });
    }

    it(`${label}: calculateChart reports the same nutation, obliquity and true ayanamsa`, () => {
      if (label === 'Tromso 2010') return; // polar: covered by the ephemeris checks above
      const d = new Date(utc);
      const input = {
        year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(),
        hour: d.getUTCHours(), minute: d.getUTCMinutes(), second: d.getUTCSeconds(),
        utcOffsetHours: 0, latitude: 3.139, longitude: 101.6869,
      };
      const chart = calculateChart(input, {
        ayanamsa: 'kp_old',
        nodeAgentRuleSet: 'none',
        rulingPlanetSet: 'asc_star_sign_moon_star_sign_day_lord',
      });
      expect(Math.abs(chart.nutationInLongitude * 3600 - dPsi)).toBeLessThanOrEqual(0.001);
      expect(Math.abs(chart.nutationInObliquity * 3600 - dEps)).toBeLessThanOrEqual(0.001);
      expect(Math.abs(chart.obliquityTrue - trueEps) * 3600).toBeLessThanOrEqual(0.001);
      expect(Math.abs(chart.ayanamsaValue - AUDIT_AYANAMSA[i].kp_old.true) * 3600).toBeLessThanOrEqual(0.001);
    });
  });
});

describe('planet longitudes use the same nutation (#57)', () => {
  // astronomy-engine returns the planets in ITS true equinox of date. The engine moves them to
  // the 77-term nutation by adding (dPsi_new - dPsi_astronomy-engine); nutation in longitude is an
  // exact rotation about the ecliptic pole, so only the longitude changes.
  const BODIES = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'] as const;

  function aeTropical(body: (typeof BODIES)[number], t: Astronomy.AstroTime): number {
    if (body === 'Sun') return Astronomy.SunPosition(t).elon;
    if (body === 'Moon') return Astronomy.EclipticGeoMoon(t).lon;
    return Astronomy.Ecliptic(Astronomy.GeoVector(Astronomy.Body[body], t, true)).elon;
  }
  const wrap = (x: number): number => ((((x + 180) % 360) + 360) % 360) - 180;

  AUDIT.forEach(([label, , dPsiSe], i) => {
    const utc = AUDIT_UTC[i];
    const t = Astronomy.MakeTime(new Date(utc));
    const aeDpsi = Astronomy.e_tilt(t).dpsi;

    for (const mode of ['kp_old', 'kp_new'] as const) {
      it(`${label} ${mode}: tropical = astronomy-engine + (Swiss Ephemeris dPsi - astronomy-engine dPsi)`, () => {
        const r = calculateEphemeris(new Date(utc), { ayanamsa: mode });
        for (const name of BODIES) {
          const p = r.planets.find((x) => x.name === name as PlanetName)!;
          const shiftArcsec = wrap(p.tropicalLongitude - aeTropical(name, t)) * 3600;
          expect(Math.abs(shiftArcsec - (dPsiSe - aeDpsi)), name).toBeLessThanOrEqual(0.001);
        }
      });

      it(`${label} ${mode}: sidereal longitudes do not depend on the nutation model (dPsi cancels)`, () => {
        // sidereal = (AE true lon - AE dPsi) - mean ayanamsa = mean-of-date longitude - mean ayanamsa
        const r = calculateEphemeris(new Date(utc), { ayanamsa: mode });
        for (const name of BODIES) {
          const p = r.planets.find((x) => x.name === name as PlanetName)!;
          const meanOfDate = aeTropical(name, t) - aeDpsi / 3600.0;
          const expected = normalizeDegrees(meanOfDate - r.meanAyanamsaDeg);
          expect(Math.abs(wrap(p.siderealLongitude - expected)) * 3600, name).toBeLessThan(1e-6);
        }
      });
    }

    it(`${label}: the mean node is in the same frame (mean node + dPsi)`, () => {
      const r = calculateEphemeris(new Date(utc), { ayanamsa: 'kp_old' });
      const rahu = r.planets.find((x) => x.name === 'Rahu')!;
      const ketu = r.planets.find((x) => x.name === 'Ketu')!;
      expect(Math.abs(wrap(rahu.tropicalLongitude - rahu.siderealLongitude) - (r.meanAyanamsaDeg + r.nutationInLongitudeDeg))).toBeLessThan(1e-9);
      expect(Math.abs(wrap(ketu.tropicalLongitude - rahu.tropicalLongitude - 180))).toBeLessThan(1e-9);
    });
  });
});

describe('KPSTLA and Nil add no nutation to the ayanamsa (owner, #29)', () => {
  for (const [label, , dPsiSe] of AUDIT) {
    const utc = AUDIT_UTC[AUDIT.findIndex((a) => a[0] === label)];
    it(`${label}: KPSTLA true ayanamsa = mean; Nil is 0; dPsi is still reported`, () => {
      const kpstla = calculateEphemeris(new Date(utc), { ayanamsa: 'kp_straight_line_adjusted' });
      expect(kpstla.trueAyanamsaDeg).toBe(kpstla.meanAyanamsaDeg);
      expect(Math.abs(kpstla.nutationInLongitudeDeg * 3600 - dPsiSe)).toBeLessThanOrEqual(0.001);
      for (const p of kpstla.planets) {
        expect(wrap360(p.tropicalLongitude - kpstla.meanAyanamsaDeg - p.siderealLongitude), p.name).toBeLessThan(1e-9);
      }
      const nil = calculateEphemeris(new Date(utc), { ayanamsa: 'nil' });
      expect(nil.trueAyanamsaDeg).toBe(0);
      expect(nil.meanAyanamsaDeg).toBe(0);
      for (const p of nil.planets) expect(p.siderealLongitude, p.name).toBeCloseTo(p.tropicalLongitude, 9);
      // The function itself: dPsi is ignored for both.
      expect(calculateAyanamsa(2451545.0, 'kp_straight_line_adjusted', 0.004).trueAyanamsa).toBe(
        calculateAyanamsa(2451545.0, 'kp_straight_line_adjusted', 0).meanAyanamsa
      );
    });
  }
});

function wrap360(x: number): number {
  return Math.abs(((((x + 180) % 360) + 360) % 360) - 180);
}
