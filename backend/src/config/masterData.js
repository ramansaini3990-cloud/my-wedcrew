/**
 * Seed catalogue for the Admin-managed master data.
 *
 * Used only by `npm run seed:master`, which is idempotent: existing records are
 * never modified or removed, only genuinely missing ones are inserted. Admins
 * can add/edit/deactivate anything afterwards from Admin -> Master Data.
 */

export const DEFAULT_PROFESSIONS = [
  { name: 'Cinematographer', description: 'Cinematic storytelling and multi-camera wedding films.', sort_order: 1 },
  { name: 'Traditional Photographer', description: 'Traditional ceremony and portrait coverage.', sort_order: 2 },
  { name: 'Wedding Photographer', description: 'Candid and documentary wedding photography.', sort_order: 3 },
  { name: 'Drone Pilot', description: 'Certified aerial operators for venue and event films.', sort_order: 4 },
  { name: 'Video Editor', description: 'Post-production and highlight film delivery.', sort_order: 5 },
  { name: 'Photo Editor', description: 'Retouching, culling and album-ready output.', sort_order: 6 },
  { name: 'Colorist', description: 'Grading and colour finishing for wedding films.', sort_order: 7 },
  { name: 'Production Assistant', description: 'On-ground support for production crews.', sort_order: 8 }
];

/**
 * Indian states and union territories, each with its major cities.
 * `code` values are the standard ISO-3166-2:IN subdivision codes.
 */
export const DEFAULT_STATES = [
  { name: 'Andhra Pradesh', code: 'AP', cities: ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Tirupati', 'Kurnool'] },
  { name: 'Arunachal Pradesh', code: 'AR', cities: ['Itanagar', 'Naharlagun', 'Pasighat'] },
  { name: 'Assam', code: 'AS', cities: ['Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Tezpur'] },
  { name: 'Bihar', code: 'BR', cities: ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Darbhanga'] },
  { name: 'Chhattisgarh', code: 'CG', cities: ['Raipur', 'Bhilai', 'Bilaspur', 'Korba'] },
  { name: 'Goa', code: 'GA', cities: ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa'] },
  { name: 'Gujarat', code: 'GJ', cities: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Gandhinagar'] },
  { name: 'Haryana', code: 'HR', cities: ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Karnal', 'Hisar'] },
  { name: 'Himachal Pradesh', code: 'HP', cities: ['Shimla', 'Manali', 'Dharamshala', 'Solan', 'Kullu'] },
  { name: 'Jharkhand', code: 'JH', cities: ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro'] },
  { name: 'Karnataka', code: 'KA', cities: ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi', 'Belagavi', 'Udupi'] },
  { name: 'Kerala', code: 'KL', cities: ['Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur', 'Kottayam', 'Alappuzha'] },
  { name: 'Madhya Pradesh', code: 'MP', cities: ['Bhopal', 'Indore', 'Gwalior', 'Jabalpur', 'Ujjain', 'Khajuraho'] },
  { name: 'Maharashtra', code: 'MH', cities: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Kolhapur', 'Thane'] },
  { name: 'Manipur', code: 'MN', cities: ['Imphal', 'Thoubal'] },
  { name: 'Meghalaya', code: 'ML', cities: ['Shillong', 'Tura'] },
  { name: 'Mizoram', code: 'MZ', cities: ['Aizawl', 'Lunglei'] },
  { name: 'Nagaland', code: 'NL', cities: ['Kohima', 'Dimapur'] },
  { name: 'Odisha', code: 'OD', cities: ['Bhubaneswar', 'Cuttack', 'Puri', 'Rourkela', 'Sambalpur'] },
  { name: 'Punjab', code: 'PB', cities: ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Mohali', 'Bathinda'] },
  { name: 'Rajasthan', code: 'RJ', cities: ['Jaipur', 'Udaipur', 'Jodhpur', 'Jaisalmer', 'Kota', 'Ajmer', 'Bikaner', 'Pushkar', 'Mount Abu'] },
  { name: 'Sikkim', code: 'SK', cities: ['Gangtok', 'Namchi'] },
  { name: 'Tamil Nadu', code: 'TN', cities: ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Ooty'] },
  { name: 'Telangana', code: 'TG', cities: ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar'] },
  { name: 'Tripura', code: 'TR', cities: ['Agartala', 'Udaipur (Tripura)'] },
  { name: 'Uttar Pradesh', code: 'UP', cities: ['Lucknow', 'Kanpur', 'Varanasi', 'Agra', 'Noida', 'Ghaziabad', 'Prayagraj', 'Mathura'] },
  { name: 'Uttarakhand', code: 'UK', cities: ['Dehradun', 'Haridwar', 'Rishikesh', 'Nainital', 'Mussoorie'] },
  { name: 'West Bengal', code: 'WB', cities: ['Kolkata', 'Siliguri', 'Darjeeling', 'Durgapur', 'Asansol', 'Howrah'] },

  // Union Territories
  { name: 'Andaman and Nicobar Islands', code: 'AN', cities: ['Port Blair'] },
  { name: 'Chandigarh', code: 'CH', cities: ['Chandigarh'] },
  { name: 'Dadra and Nagar Haveli and Daman and Diu', code: 'DH', cities: ['Daman', 'Silvassa', 'Diu'] },
  { name: 'Delhi', code: 'DL', cities: ['New Delhi', 'Delhi', 'Dwarka', 'Rohini'] },
  { name: 'Jammu and Kashmir', code: 'JK', cities: ['Srinagar', 'Jammu', 'Gulmarg', 'Pahalgam'] },
  { name: 'Ladakh', code: 'LA', cities: ['Leh', 'Kargil'] },
  { name: 'Lakshadweep', code: 'LD', cities: ['Kavaratti'] },
  { name: 'Puducherry', code: 'PY', cities: ['Puducherry', 'Karaikal'] }
];

export default { DEFAULT_PROFESSIONS, DEFAULT_STATES };
