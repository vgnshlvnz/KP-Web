/**
 * Open-source world cities dataset.
 * Data source: GeoNames (https://www.geonames.org/) under Creative Commons Attribution 4.0 License.
 * Provides accurate latitude, longitude, and IANA timezone identifiers.
 */

export interface CityEntry {
  id: string;
  name: string;
  asciiName: string;
  admin1: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export const CITIES_DATA: CityEntry[] = [
  // India - Tamil Nadu & South India
  { id: "in-chennai", name: "Chennai", asciiName: "Chennai", admin1: "Tamil Nadu", country: "India", countryCode: "IN", latitude: 13.0827, longitude: 80.2707, timezone: "Asia/Kolkata" },
  { id: "in-coimbatore", name: "Coimbatore", asciiName: "Coimbatore", admin1: "Tamil Nadu", country: "India", countryCode: "IN", latitude: 11.0168, longitude: 76.9558, timezone: "Asia/Kolkata" },
  { id: "in-madurai", name: "Madurai", asciiName: "Madurai", admin1: "Tamil Nadu", country: "India", countryCode: "IN", latitude: 9.9252, longitude: 78.1198, timezone: "Asia/Kolkata" },
  { id: "in-tiruchirappalli", name: "Tiruchirappalli", asciiName: "Tiruchirappalli", admin1: "Tamil Nadu", country: "India", countryCode: "IN", latitude: 10.7905, longitude: 78.7047, timezone: "Asia/Kolkata" },
  { id: "in-salem", name: "Salem", asciiName: "Salem", admin1: "Tamil Nadu", country: "India", countryCode: "IN", latitude: 11.6643, longitude: 78.1460, timezone: "Asia/Kolkata" },
  { id: "in-tiruppur", name: "Tiruppur", asciiName: "Tiruppur", admin1: "Tamil Nadu", country: "India", countryCode: "IN", latitude: 11.1085, longitude: 77.3411, timezone: "Asia/Kolkata" },
  { id: "in-tirunelveli", name: "Tirunelveli", asciiName: "Tirunelveli", admin1: "Tamil Nadu", country: "India", countryCode: "IN", latitude: 8.7139, longitude: 77.7567, timezone: "Asia/Kolkata" },
  { id: "in-vellore", name: "Vellore", asciiName: "Vellore", admin1: "Tamil Nadu", country: "India", countryCode: "IN", latitude: 12.9165, longitude: 79.1325, timezone: "Asia/Kolkata" },
  { id: "in-thanjavur", name: "Thanjavur", asciiName: "Thanjavur", admin1: "Tamil Nadu", country: "India", countryCode: "IN", latitude: 10.7870, longitude: 79.1378, timezone: "Asia/Kolkata" },
  { id: "in-kumbakonam", name: "Kumbakonam", asciiName: "Kumbakonam", admin1: "Tamil Nadu", country: "India", countryCode: "IN", latitude: 10.9601, longitude: 79.3845, timezone: "Asia/Kolkata" },
  { id: "in-kanchipuram", name: "Kanchipuram", asciiName: "Kanchipuram", admin1: "Tamil Nadu", country: "India", countryCode: "IN", latitude: 12.8342, longitude: 79.7036, timezone: "Asia/Kolkata" },

  // India - Karnataka, Kerala, Andhra, Telangana
  { id: "in-bengaluru", name: "Bengaluru", asciiName: "Bengaluru", admin1: "Karnataka", country: "India", countryCode: "IN", latitude: 12.9716, longitude: 77.5946, timezone: "Asia/Kolkata" },
  { id: "in-mysuru", name: "Mysuru", asciiName: "Mysuru", admin1: "Karnataka", country: "India", countryCode: "IN", latitude: 12.2958, longitude: 76.6394, timezone: "Asia/Kolkata" },
  { id: "in-mangaluru", name: "Mangaluru", asciiName: "Mangaluru", admin1: "Karnataka", country: "India", countryCode: "IN", latitude: 12.9141, longitude: 74.8560, timezone: "Asia/Kolkata" },
  { id: "in-hubballi", name: "Hubballi", asciiName: "Hubballi", admin1: "Karnataka", country: "India", countryCode: "IN", latitude: 15.3647, longitude: 75.1240, timezone: "Asia/Kolkata" },
  { id: "in-hyderabad", name: "Hyderabad", asciiName: "Hyderabad", admin1: "Telangana", country: "India", countryCode: "IN", latitude: 17.3850, longitude: 78.4867, timezone: "Asia/Kolkata" },
  { id: "in-warangal", name: "Warangal", asciiName: "Warangal", admin1: "Telangana", country: "India", countryCode: "IN", latitude: 17.9689, longitude: 79.5941, timezone: "Asia/Kolkata" },
  { id: "in-visakhapatnam", name: "Visakhapatnam", asciiName: "Visakhapatnam", admin1: "Andhra Pradesh", country: "India", countryCode: "IN", latitude: 17.6868, longitude: 83.2185, timezone: "Asia/Kolkata" },
  { id: "in-vijayawada", name: "Vijayawada", asciiName: "Vijayawada", admin1: "Andhra Pradesh", country: "India", countryCode: "IN", latitude: 16.5062, longitude: 80.6480, timezone: "Asia/Kolkata" },
  { id: "in-tirupati", name: "Tirupati", asciiName: "Tirupati", admin1: "Andhra Pradesh", country: "India", countryCode: "IN", latitude: 13.6288, longitude: 79.4192, timezone: "Asia/Kolkata" },
  { id: "in-thiruvananthapuram", name: "Thiruvananthapuram", asciiName: "Thiruvananthapuram", admin1: "Kerala", country: "India", countryCode: "IN", latitude: 8.5241, longitude: 76.9366, timezone: "Asia/Kolkata" },
  { id: "in-kochi", name: "Kochi", asciiName: "Kochi", admin1: "Kerala", country: "India", countryCode: "IN", latitude: 9.9312, longitude: 76.2673, timezone: "Asia/Kolkata" },
  { id: "in-kozhikode", name: "Kozhikode", asciiName: "Kozhikode", admin1: "Kerala", country: "India", countryCode: "IN", latitude: 11.2588, longitude: 75.7804, timezone: "Asia/Kolkata" },
  { id: "in-thrissur", name: "Thrissur", asciiName: "Thrissur", admin1: "Kerala", country: "India", countryCode: "IN", latitude: 10.5276, longitude: 76.2144, timezone: "Asia/Kolkata" },

  // India - Maharashtra & West
  { id: "in-mumbai", name: "Mumbai", asciiName: "Mumbai", admin1: "Maharashtra", country: "India", countryCode: "IN", latitude: 19.0760, longitude: 72.8777, timezone: "Asia/Kolkata" },
  { id: "in-pune", name: "Pune", asciiName: "Pune", admin1: "Maharashtra", country: "India", countryCode: "IN", latitude: 18.5204, longitude: 73.8567, timezone: "Asia/Kolkata" },
  { id: "in-nagpur", name: "Nagpur", asciiName: "Nagpur", admin1: "Maharashtra", country: "India", countryCode: "IN", latitude: 21.1458, longitude: 79.0882, timezone: "Asia/Kolkata" },
  { id: "in-nashik", name: "Nashik", asciiName: "Nashik", admin1: "Maharashtra", country: "India", countryCode: "IN", latitude: 19.9975, longitude: 73.7898, timezone: "Asia/Kolkata" },
  { id: "in-aurangabad", name: "Chhatrapati Sambhajinagar", asciiName: "Aurangabad", admin1: "Maharashtra", country: "India", countryCode: "IN", latitude: 19.8762, longitude: 75.3433, timezone: "Asia/Kolkata" },
  { id: "in-ahmedabad", name: "Ahmedabad", asciiName: "Ahmedabad", admin1: "Gujarat", country: "India", countryCode: "IN", latitude: 23.0225, longitude: 72.5714, timezone: "Asia/Kolkata" },
  { id: "in-surat", name: "Surat", asciiName: "Surat", admin1: "Gujarat", country: "India", countryCode: "IN", latitude: 21.1702, longitude: 72.8311, timezone: "Asia/Kolkata" },
  { id: "in-vadodara", name: "Vadodara", asciiName: "Vadodara", admin1: "Gujarat", country: "India", countryCode: "IN", latitude: 22.3072, longitude: 73.1812, timezone: "Asia/Kolkata" },
  { id: "in-rajkot", name: "Rajkot", asciiName: "Rajkot", admin1: "Gujarat", country: "India", countryCode: "IN", latitude: 22.3039, longitude: 70.8022, timezone: "Asia/Kolkata" },

  // India - North & Central
  { id: "in-delhi", name: "New Delhi", asciiName: "New Delhi", admin1: "Delhi", country: "India", countryCode: "IN", latitude: 28.6139, longitude: 77.2090, timezone: "Asia/Kolkata" },
  { id: "in-noida", name: "Noida", asciiName: "Noida", admin1: "Uttar Pradesh", country: "India", countryCode: "IN", latitude: 28.5355, longitude: 77.3910, timezone: "Asia/Kolkata" },
  { id: "in-gurugram", name: "Gurugram", asciiName: "Gurugram", admin1: "Haryana", country: "India", countryCode: "IN", latitude: 28.4595, longitude: 77.0266, timezone: "Asia/Kolkata" },
  { id: "in-lucknow", name: "Lucknow", asciiName: "Lucknow", admin1: "Uttar Pradesh", country: "India", countryCode: "IN", latitude: 26.8467, longitude: 80.9462, timezone: "Asia/Kolkata" },
  { id: "in-kanpur", name: "Kanpur", asciiName: "Kanpur", admin1: "Uttar Pradesh", country: "India", countryCode: "IN", latitude: 26.4499, longitude: 80.3319, timezone: "Asia/Kolkata" },
  { id: "in-varanasi", name: "Varanasi", asciiName: "Varanasi", admin1: "Uttar Pradesh", country: "India", countryCode: "IN", latitude: 25.3176, longitude: 82.9739, timezone: "Asia/Kolkata" },
  { id: "in-prayagraj", name: "Prayagraj", asciiName: "Prayagraj", admin1: "Uttar Pradesh", country: "India", countryCode: "IN", latitude: 25.4358, longitude: 81.8463, timezone: "Asia/Kolkata" },
  { id: "in-agra", name: "Agra", asciiName: "Agra", admin1: "Uttar Pradesh", country: "India", countryCode: "IN", latitude: 27.1767, longitude: 78.0081, timezone: "Asia/Kolkata" },
  { id: "in-jaipur", name: "Jaipur", asciiName: "Jaipur", admin1: "Rajasthan", country: "India", countryCode: "IN", latitude: 26.9124, longitude: 75.7873, timezone: "Asia/Kolkata" },
  { id: "in-jodhpur", name: "Jodhpur", asciiName: "Jodhpur", admin1: "Rajasthan", country: "India", countryCode: "IN", latitude: 26.2389, longitude: 73.0243, timezone: "Asia/Kolkata" },
  { id: "in-udaipur", name: "Udaipur", asciiName: "Udaipur", admin1: "Rajasthan", country: "India", countryCode: "IN", latitude: 24.5854, longitude: 73.7125, timezone: "Asia/Kolkata" },
  { id: "in-bhopal", name: "Bhopal", asciiName: "Bhopal", admin1: "Madhya Pradesh", country: "India", countryCode: "IN", latitude: 23.2599, longitude: 77.4126, timezone: "Asia/Kolkata" },
  { id: "in-indore", name: "Indore", asciiName: "Indore", admin1: "Madhya Pradesh", country: "India", countryCode: "IN", latitude: 22.7196, longitude: 75.8577, timezone: "Asia/Kolkata" },
  { id: "in-chandigarh", name: "Chandigarh", asciiName: "Chandigarh", admin1: "Chandigarh", country: "India", countryCode: "IN", latitude: 30.7333, longitude: 76.7794, timezone: "Asia/Kolkata" },
  { id: "in-amritsar", name: "Amritsar", asciiName: "Amritsar", admin1: "Punjab", country: "India", countryCode: "IN", latitude: 31.6340, longitude: 74.8723, timezone: "Asia/Kolkata" },
  { id: "in-dehradun", name: "Dehradun", asciiName: "Dehradun", admin1: "Uttarakhand", country: "India", countryCode: "IN", latitude: 30.3165, longitude: 78.0322, timezone: "Asia/Kolkata" },
  { id: "in-haridwar", name: "Haridwar", asciiName: "Haridwar", admin1: "Uttarakhand", country: "India", countryCode: "IN", latitude: 29.9457, longitude: 78.1642, timezone: "Asia/Kolkata" },
  { id: "in-srinagar", name: "Srinagar", asciiName: "Srinagar", admin1: "Jammu and Kashmir", country: "India", countryCode: "IN", latitude: 34.0837, longitude: 74.7973, timezone: "Asia/Kolkata" },

  // India - East & Northeast
  { id: "in-kolkata", name: "Kolkata", asciiName: "Kolkata", admin1: "West Bengal", country: "India", countryCode: "IN", latitude: 22.5726, longitude: 88.3639, timezone: "Asia/Kolkata" },
  { id: "in-howrah", name: "Howrah", asciiName: "Howrah", admin1: "West Bengal", country: "India", countryCode: "IN", latitude: 22.5958, longitude: 88.2636, timezone: "Asia/Kolkata" },
  { id: "in-patna", name: "Patna", asciiName: "Patna", admin1: "Bihar", country: "India", countryCode: "IN", latitude: 25.5941, longitude: 85.1376, timezone: "Asia/Kolkata" },
  { id: "in-bhubaneswar", name: "Bhubaneswar", asciiName: "Bhubaneswar", admin1: "Odisha", country: "India", countryCode: "IN", latitude: 20.2961, longitude: 85.8245, timezone: "Asia/Kolkata" },
  { id: "in-puri", name: "Puri", asciiName: "Puri", admin1: "Odisha", country: "India", countryCode: "IN", latitude: 19.8135, longitude: 85.8312, timezone: "Asia/Kolkata" },
  { id: "in-cuttack", name: "Cuttack", asciiName: "Cuttack", admin1: "Odisha", country: "India", countryCode: "IN", latitude: 20.4625, longitude: 85.8828, timezone: "Asia/Kolkata" },
  { id: "in-ranchi", name: "Ranchi", asciiName: "Ranchi", admin1: "Jharkhand", country: "India", countryCode: "IN", latitude: 23.3441, longitude: 85.3096, timezone: "Asia/Kolkata" },
  { id: "in-jamshedpur", name: "Jamshedpur", asciiName: "Jamshedpur", admin1: "Jharkhand", country: "India", countryCode: "IN", latitude: 22.8046, longitude: 86.2029, timezone: "Asia/Kolkata" },
  { id: "in-raipur", name: "Raipur", asciiName: "Raipur", admin1: "Chhattisgarh", country: "India", countryCode: "IN", latitude: 21.2514, longitude: 81.6296, timezone: "Asia/Kolkata" },
  { id: "in-guwahati", name: "Guwahati", asciiName: "Guwahati", admin1: "Assam", country: "India", countryCode: "IN", latitude: 26.1445, longitude: 91.7362, timezone: "Asia/Kolkata" },

  // Malaysia
  { id: "my-kualalumpur", name: "Kuala Lumpur", asciiName: "Kuala Lumpur", admin1: "Kuala Lumpur", country: "Malaysia", countryCode: "MY", latitude: 3.1390, longitude: 101.6869, timezone: "Asia/Kuala_Lumpur" },
  { id: "my-georgetown", name: "George Town", asciiName: "George Town", admin1: "Penang", country: "Malaysia", countryCode: "MY", latitude: 5.4164, longitude: 100.3327, timezone: "Asia/Kuala_Lumpur" },
  { id: "my-ipoh", name: "Ipoh", asciiName: "Ipoh", admin1: "Perak", country: "Malaysia", countryCode: "MY", latitude: 4.5975, longitude: 101.0901, timezone: "Asia/Kuala_Lumpur" },
  { id: "my-johorbahru", name: "Johor Bahru", asciiName: "Johor Bahru", admin1: "Johor", country: "Malaysia", countryCode: "MY", latitude: 1.4927, longitude: 103.7414, timezone: "Asia/Kuala_Lumpur" },
  { id: "my-petalingjaya", name: "Petaling Jaya", asciiName: "Petaling Jaya", admin1: "Selangor", country: "Malaysia", countryCode: "MY", latitude: 3.1073, longitude: 101.6067, timezone: "Asia/Kuala_Lumpur" },
  { id: "my-shahalam", name: "Shah Alam", asciiName: "Shah Alam", admin1: "Selangor", country: "Malaysia", countryCode: "MY", latitude: 3.0738, longitude: 101.5183, timezone: "Asia/Kuala_Lumpur" },
  { id: "my-klang", name: "Klang", asciiName: "Klang", admin1: "Selangor", country: "Malaysia", countryCode: "MY", latitude: 3.0449, longitude: 101.4456, timezone: "Asia/Kuala_Lumpur" },
  { id: "my-melaka", name: "Malacca", asciiName: "Malacca", admin1: "Melaka", country: "Malaysia", countryCode: "MY", latitude: 2.1896, longitude: 102.2501, timezone: "Asia/Kuala_Lumpur" },
  { id: "my-seremban", name: "Seremban", asciiName: "Seremban", admin1: "Negeri Sembilan", country: "Malaysia", countryCode: "MY", latitude: 2.7258, longitude: 101.9424, timezone: "Asia/Kuala_Lumpur" },
  { id: "my-kuantan", name: "Kuantan", asciiName: "Kuantan", admin1: "Pahang", country: "Malaysia", countryCode: "MY", latitude: 3.8077, longitude: 103.3260, timezone: "Asia/Kuala_Lumpur" },
  { id: "my-kotabharu", name: "Kota Bharu", asciiName: "Kota Bharu", admin1: "Kelantan", country: "Malaysia", countryCode: "MY", latitude: 6.1254, longitude: 102.2381, timezone: "Asia/Kuala_Lumpur" },
  { id: "my-kualaterengganu", name: "Kuala Terengganu", asciiName: "Kuala Terengganu", admin1: "Terengganu", country: "Malaysia", countryCode: "MY", latitude: 5.3117, longitude: 103.1324, timezone: "Asia/Kuala_Lumpur" },
  { id: "my-alorsetar", name: "Alor Setar", asciiName: "Alor Setar", admin1: "Kedah", country: "Malaysia", countryCode: "MY", latitude: 6.1248, longitude: 100.3678, timezone: "Asia/Kuala_Lumpur" },
  { id: "my-kangar", name: "Kangar", asciiName: "Kangar", admin1: "Perlis", country: "Malaysia", countryCode: "MY", latitude: 6.4414, longitude: 100.1986, timezone: "Asia/Kuala_Lumpur" },
  { id: "my-kuching", name: "Kuching", asciiName: "Kuching", admin1: "Sarawak", country: "Malaysia", countryCode: "MY", latitude: 1.5533, longitude: 110.3592, timezone: "Asia/Kuching" },
  { id: "my-miri", name: "Miri", asciiName: "Miri", admin1: "Sarawak", country: "Malaysia", countryCode: "MY", latitude: 4.3995, longitude: 113.9914, timezone: "Asia/Kuching" },
  { id: "my-kotakinabalu", name: "Kota Kinabalu", asciiName: "Kota Kinabalu", admin1: "Sabah", country: "Malaysia", countryCode: "MY", latitude: 5.9804, longitude: 116.0735, timezone: "Asia/Kuching" },
  { id: "my-sandakan", name: "Sandakan", asciiName: "Sandakan", admin1: "Sabah", country: "Malaysia", countryCode: "MY", latitude: 5.8402, longitude: 118.1179, timezone: "Asia/Kuching" },
  { id: "my-putrajaya", name: "Putrajaya", asciiName: "Putrajaya", admin1: "Putrajaya", country: "Malaysia", countryCode: "MY", latitude: 2.9264, longitude: 101.6964, timezone: "Asia/Kuala_Lumpur" },

  // Singapore & Neighboring Countries
  { id: "sg-singapore", name: "Singapore", asciiName: "Singapore", admin1: "Singapore", country: "Singapore", countryCode: "SG", latitude: 1.3521, longitude: 103.8198, timezone: "Asia/Singapore" },
  { id: "lk-colombo", name: "Colombo", asciiName: "Colombo", admin1: "Western", country: "Sri Lanka", countryCode: "LK", latitude: 6.9271, longitude: 79.8612, timezone: "Asia/Colombo" },
  { id: "lk-jaffna", name: "Jaffna", asciiName: "Jaffna", admin1: "Northern", country: "Sri Lanka", countryCode: "LK", latitude: 9.6615, longitude: 80.0255, timezone: "Asia/Colombo" },
  { id: "lk-kandy", name: "Kandy", asciiName: "Kandy", admin1: "Central", country: "Sri Lanka", countryCode: "LK", latitude: 7.2906, longitude: 80.6337, timezone: "Asia/Colombo" },
  { id: "np-kathmandu", name: "Kathmandu", asciiName: "Kathmandu", admin1: "Bagmati", country: "Nepal", countryCode: "NP", latitude: 27.7172, longitude: 85.3240, timezone: "Asia/Kathmandu" },
  { id: "np-pokhara", name: "Pokhara", asciiName: "Pokhara", admin1: "Gandaki", country: "Nepal", countryCode: "NP", latitude: 28.2096, longitude: 83.9856, timezone: "Asia/Kathmandu" },
  { id: "bd-dhaka", name: "Dhaka", asciiName: "Dhaka", admin1: "Dhaka", country: "Bangladesh", countryCode: "BD", latitude: 23.8103, longitude: 90.4125, timezone: "Asia/Dhaka" },
  { id: "bd-chittagong", name: "Chittagong", asciiName: "Chittagong", admin1: "Chittagong", country: "Bangladesh", countryCode: "BD", latitude: 22.3569, longitude: 91.7832, timezone: "Asia/Dhaka" },
  { id: "pk-karachi", name: "Karachi", asciiName: "Karachi", admin1: "Sindh", country: "Pakistan", countryCode: "PK", latitude: 24.8607, longitude: 67.0011, timezone: "Asia/Karachi" },
  { id: "pk-lahore", name: "Lahore", asciiName: "Lahore", admin1: "Punjab", country: "Pakistan", countryCode: "PK", latitude: 31.5204, longitude: 74.3587, timezone: "Asia/Karachi" },
  { id: "pk-islamabad", name: "Islamabad", asciiName: "Islamabad", admin1: "Islamabad", country: "Pakistan", countryCode: "PK", latitude: 33.6844, longitude: 73.0479, timezone: "Asia/Karachi" },

  // Middle East
  { id: "ae-dubai", name: "Dubai", asciiName: "Dubai", admin1: "Dubai", country: "United Arab Emirates", countryCode: "AE", latitude: 25.2048, longitude: 55.2708, timezone: "Asia/Dubai" },
  { id: "ae-abudhabi", name: "Abu Dhabi", asciiName: "Abu Dhabi", admin1: "Abu Dhabi", country: "United Arab Emirates", countryCode: "AE", latitude: 24.4539, longitude: 54.3773, timezone: "Asia/Dubai" },
  { id: "qa-doha", name: "Doha", asciiName: "Doha", admin1: "Ad Dawhah", country: "Qatar", countryCode: "QA", latitude: 25.2854, longitude: 51.5310, timezone: "Asia/Qatar" },
  { id: "sa-riyadh", name: "Riyadh", asciiName: "Riyadh", admin1: "Riyadh", country: "Saudi Arabia", countryCode: "SA", latitude: 24.7136, longitude: 46.6753, timezone: "Asia/Riyadh" },
  { id: "sa-jeddah", name: "Jeddah", asciiName: "Jeddah", admin1: "Makkah", country: "Saudi Arabia", countryCode: "SA", latitude: 21.4858, longitude: 39.1925, timezone: "Asia/Riyadh" },
  { id: "kw-kuwait", name: "Kuwait City", asciiName: "Kuwait City", admin1: "Al Asimah", country: "Kuwait", countryCode: "KW", latitude: 29.3759, longitude: 47.9774, timezone: "Asia/Kuwait" },
  { id: "om-muscat", name: "Muscat", asciiName: "Muscat", admin1: "Muscat", country: "Oman", countryCode: "OM", latitude: 23.5880, longitude: 58.3829, timezone: "Asia/Muscat" },
  { id: "bh-manama", name: "Manama", asciiName: "Manama", admin1: "Capital", country: "Bahrain", countryCode: "BH", latitude: 26.2285, longitude: 50.5860, timezone: "Asia/Bahrain" },

  // United Kingdom & Europe
  { id: "gb-london", name: "London", asciiName: "London", admin1: "England", country: "United Kingdom", countryCode: "GB", latitude: 51.5074, longitude: -0.1278, timezone: "Europe/London" },
  { id: "gb-birmingham", name: "Birmingham", asciiName: "Birmingham", admin1: "England", country: "United Kingdom", countryCode: "GB", latitude: 52.4862, longitude: -1.8904, timezone: "Europe/London" },
  { id: "gb-manchester", name: "Manchester", asciiName: "Manchester", admin1: "England", country: "United Kingdom", countryCode: "GB", latitude: 53.4808, longitude: -2.2426, timezone: "Europe/London" },
  { id: "gb-leeds", name: "Leeds", asciiName: "Leeds", admin1: "England", country: "United Kingdom", countryCode: "GB", latitude: 53.8008, longitude: -1.5491, timezone: "Europe/London" },
  { id: "gb-glasgow", name: "Glasgow", asciiName: "Glasgow", admin1: "Scotland", country: "United Kingdom", countryCode: "GB", latitude: 55.8642, longitude: -4.2518, timezone: "Europe/London" },
  { id: "gb-edinburgh", name: "Edinburgh", asciiName: "Edinburgh", admin1: "Scotland", country: "United Kingdom", countryCode: "GB", latitude: 55.9533, longitude: -3.1883, timezone: "Europe/London" },
  { id: "gb-cardiff", name: "Cardiff", asciiName: "Cardiff", admin1: "Wales", country: "United Kingdom", countryCode: "GB", latitude: 51.4816, longitude: -3.1791, timezone: "Europe/London" },
  { id: "gb-belfast", name: "Belfast", asciiName: "Belfast", admin1: "Northern Ireland", country: "United Kingdom", countryCode: "GB", latitude: 54.5973, longitude: -5.9301, timezone: "Europe/London" },
  { id: "ie-dublin", name: "Dublin", asciiName: "Dublin", admin1: "Leinster", country: "Ireland", countryCode: "IE", latitude: 53.3498, longitude: -6.2603, timezone: "Europe/Dublin" },
  { id: "fr-paris", name: "Paris", asciiName: "Paris", admin1: "Ile-de-France", country: "France", countryCode: "FR", latitude: 48.8566, longitude: 2.3522, timezone: "Europe/Paris" },
  { id: "de-berlin", name: "Berlin", asciiName: "Berlin", admin1: "Berlin", country: "Germany", countryCode: "DE", latitude: 52.5200, longitude: 13.4050, timezone: "Europe/Berlin" },
  { id: "de-frankfurt", name: "Frankfurt", asciiName: "Frankfurt", admin1: "Hesse", country: "Germany", countryCode: "DE", latitude: 50.1109, longitude: 8.6821, timezone: "Europe/Berlin" },
  { id: "de-munich", name: "Munich", asciiName: "Munich", admin1: "Bavaria", country: "Germany", countryCode: "DE", latitude: 48.1351, longitude: 11.5820, timezone: "Europe/Berlin" },
  { id: "nl-amsterdam", name: "Amsterdam", asciiName: "Amsterdam", admin1: "North Holland", country: "Netherlands", countryCode: "NL", latitude: 52.3676, longitude: 4.9041, timezone: "Europe/Amsterdam" },
  { id: "ch-zurich", name: "Zurich", asciiName: "Zurich", admin1: "Zurich", country: "Switzerland", countryCode: "CH", latitude: 47.3769, longitude: 8.5417, timezone: "Europe/Zurich" },
  { id: "ch-geneva", name: "Geneva", asciiName: "Geneva", admin1: "Geneva", country: "Switzerland", countryCode: "CH", latitude: 46.2044, longitude: 6.1432, timezone: "Europe/Zurich" },
  { id: "it-rome", name: "Rome", asciiName: "Rome", admin1: "Lazio", country: "Italy", countryCode: "IT", latitude: 41.9028, longitude: 12.4964, timezone: "Europe/Rome" },
  { id: "es-madrid", name: "Madrid", asciiName: "Madrid", admin1: "Madrid", country: "Spain", countryCode: "ES", latitude: 40.4168, longitude: -3.7038, timezone: "Europe/Madrid" },

  // United States & Canada
  { id: "us-newyork", name: "New York", asciiName: "New York", admin1: "New York", country: "United States", countryCode: "US", latitude: 40.7128, longitude: -74.0060, timezone: "America/New_York" },
  { id: "us-losangeles", name: "Los Angeles", asciiName: "Los Angeles", admin1: "California", country: "United States", countryCode: "US", latitude: 34.0522, longitude: -118.2437, timezone: "America/Los_Angeles" },
  { id: "us-chicago", name: "Chicago", asciiName: "Chicago", admin1: "Illinois", country: "United States", countryCode: "US", latitude: 41.8781, longitude: -87.6298, timezone: "America/Chicago" },
  { id: "us-houston", name: "Houston", asciiName: "Houston", admin1: "Texas", country: "United States", countryCode: "US", latitude: 29.7604, longitude: -95.3698, timezone: "America/Chicago" },
  { id: "us-phoenix", name: "Phoenix", asciiName: "Phoenix", admin1: "Arizona", country: "United States", countryCode: "US", latitude: 33.4484, longitude: -112.0740, timezone: "America/Phoenix" },
  { id: "us-philadelphia", name: "Philadelphia", asciiName: "Philadelphia", admin1: "Pennsylvania", country: "United States", countryCode: "US", latitude: 39.9526, longitude: -75.1652, timezone: "America/New_York" },
  { id: "us-sanantonio", name: "San Antonio", asciiName: "San Antonio", admin1: "Texas", country: "United States", countryCode: "US", latitude: 29.4241, longitude: -98.4936, timezone: "America/Chicago" },
  { id: "us-sandiego", name: "San Diego", asciiName: "San Diego", admin1: "California", country: "United States", countryCode: "US", latitude: 32.7157, longitude: -117.1611, timezone: "America/Los_Angeles" },
  { id: "us-dallas", name: "Dallas", asciiName: "Dallas", admin1: "Texas", country: "United States", countryCode: "US", latitude: 32.7767, longitude: -96.7970, timezone: "America/Chicago" },
  { id: "us-sanjose", name: "San Jose", asciiName: "San Jose", admin1: "California", country: "United States", countryCode: "US", latitude: 37.3382, longitude: -121.8863, timezone: "America/Los_Angeles" },
  { id: "us-austin", name: "Austin", asciiName: "Austin", admin1: "Texas", country: "United States", countryCode: "US", latitude: 30.2672, longitude: -97.7431, timezone: "America/Chicago" },
  { id: "us-sanfrancisco", name: "San Francisco", asciiName: "San Francisco", admin1: "California", country: "United States", countryCode: "US", latitude: 37.7749, longitude: -122.4194, timezone: "America/Los_Angeles" },
  { id: "us-seattle", name: "Seattle", asciiName: "Seattle", admin1: "Washington", country: "United States", countryCode: "US", latitude: 47.6062, longitude: -122.3321, timezone: "America/Los_Angeles" },
  { id: "us-denver", name: "Denver", asciiName: "Denver", admin1: "Colorado", country: "United States", countryCode: "US", latitude: 39.7392, longitude: -104.9903, timezone: "America/Denver" },
  { id: "us-washington", name: "Washington", asciiName: "Washington", admin1: "District of Columbia", country: "United States", countryCode: "US", latitude: 38.9072, longitude: -77.0369, timezone: "America/New_York" },
  { id: "us-boston", name: "Boston", asciiName: "Boston", admin1: "Massachusetts", country: "United States", countryCode: "US", latitude: 42.3601, longitude: -71.0589, timezone: "America/New_York" },
  { id: "us-atlanta", name: "Atlanta", asciiName: "Atlanta", admin1: "Georgia", country: "United States", countryCode: "US", latitude: 33.7490, longitude: -84.3880, timezone: "America/New_York" },
  { id: "us-miami", name: "Miami", asciiName: "Miami", admin1: "Florida", country: "United States", countryCode: "US", latitude: 25.7617, longitude: -80.1918, timezone: "America/New_York" },
  { id: "ca-toronto", name: "Toronto", asciiName: "Toronto", admin1: "Ontario", country: "Canada", countryCode: "CA", latitude: 43.6532, longitude: -79.3832, timezone: "America/Toronto" },
  { id: "ca-vancouver", name: "Vancouver", asciiName: "Vancouver", admin1: "British Columbia", country: "Canada", countryCode: "CA", latitude: 49.2827, longitude: -123.1207, timezone: "America/Vancouver" },
  { id: "ca-montreal", name: "Montreal", asciiName: "Montreal", admin1: "Quebec", country: "Canada", countryCode: "CA", latitude: 45.5017, longitude: -73.5673, timezone: "America/Toronto" },

  // Australia & New Zealand
  { id: "au-sydney", name: "Sydney", asciiName: "Sydney", admin1: "New South Wales", country: "Australia", countryCode: "AU", latitude: -33.8688, longitude: 151.2093, timezone: "Australia/Sydney" },
  { id: "au-melbourne", name: "Melbourne", asciiName: "Melbourne", admin1: "Victoria", country: "Australia", countryCode: "AU", latitude: -37.8136, longitude: 144.9631, timezone: "Australia/Melbourne" },
  { id: "au-brisbane", name: "Brisbane", asciiName: "Brisbane", admin1: "Queensland", country: "Australia", countryCode: "AU", latitude: -27.4698, longitude: 153.0251, timezone: "Australia/Brisbane" },
  { id: "au-perth", name: "Perth", asciiName: "Perth", admin1: "Western Australia", country: "Australia", countryCode: "AU", latitude: -31.9505, longitude: 115.8605, timezone: "Australia/Perth" },
  { id: "nz-auckland", name: "Auckland", asciiName: "Auckland", admin1: "Auckland", country: "New Zealand", countryCode: "NZ", latitude: -36.8485, longitude: 174.7633, timezone: "Pacific/Auckland" },

  // East & Southeast Asia
  { id: "jp-tokyo", name: "Tokyo", asciiName: "Tokyo", admin1: "Tokyo", country: "Japan", countryCode: "JP", latitude: 35.6762, longitude: 139.6503, timezone: "Asia/Tokyo" },
  { id: "kr-seoul", name: "Seoul", asciiName: "Seoul", admin1: "Seoul", country: "South Korea", countryCode: "KR", latitude: 37.5665, longitude: 126.9780, timezone: "Asia/Seoul" },
  { id: "th-bangkok", name: "Bangkok", asciiName: "Bangkok", admin1: "Bangkok", country: "Thailand", countryCode: "TH", latitude: 13.7563, longitude: 100.5018, timezone: "Asia/Bangkok" },
  { id: "id-jakarta", name: "Jakarta", asciiName: "Jakarta", admin1: "Jakarta", country: "Indonesia", countryCode: "ID", latitude: -6.2088, longitude: 106.8456, timezone: "Asia/Jakarta" },
  { id: "ph-manila", name: "Manila", asciiName: "Manila", admin1: "Metro Manila", country: "Philippines", countryCode: "PH", latitude: 14.5995, longitude: 120.9842, timezone: "Asia/Manila" },
  { id: "hk-hongkong", name: "Hong Kong", asciiName: "Hong Kong", admin1: "Hong Kong", country: "Hong Kong", countryCode: "HK", latitude: 22.3193, longitude: 114.1694, timezone: "Asia/Hong_Kong" },

  // Africa & South America
  { id: "za-johannesburg", name: "Johannesburg", asciiName: "Johannesburg", admin1: "Gauteng", country: "South Africa", countryCode: "ZA", latitude: -26.2041, longitude: 28.0473, timezone: "Africa/Johannesburg" },
  { id: "za-capetown", name: "Cape Town", asciiName: "Cape Town", admin1: "Western Cape", country: "South Africa", countryCode: "ZA", latitude: -33.9249, longitude: 18.4241, timezone: "Africa/Johannesburg" },
  { id: "eg-cairo", name: "Cairo", asciiName: "Cairo", admin1: "Cairo", country: "Egypt", countryCode: "EG", latitude: 30.0444, longitude: 31.2357, timezone: "Africa/Cairo" },
  { id: "br-saopaulo", name: "Sao Paulo", asciiName: "Sao Paulo", admin1: "Sao Paulo", country: "Brazil", countryCode: "BR", latitude: -23.5505, longitude: -46.6333, timezone: "America/Sao_Paulo" },
  { id: "ar-buenosaires", name: "Buenos Aires", asciiName: "Buenos Aires", admin1: "Buenos Aires", country: "Argentina", countryCode: "AR", latitude: -34.6037, longitude: -58.3816, timezone: "America/Argentina/Buenos_Aires" }
];
