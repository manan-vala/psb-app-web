/**
 * Mocked demo data, carried over from the Expo app so both clients show the
 * same account, payees, and transactions.
 */

export const AVATAR_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCYQjBgeQDeL4JdgQLQTNs6N5dkEhVauZMUCcHKvAMrKNFe3v6t_02_8LTqiaSeOQafTBon_m18Gxmns89OPvk06uKEXhxcvnL66O_zrmjTONka4RWnGkPuDy6izVg74IwveKr75UUXszRLsJ_WtqtxMCzrs394mNf76OIjflVp5o_WVp9jlTY7osmc1hrLnOUwrzzU5f1H5137udqy8Om7aKv-fWjMFLH3WiTWV18pVVCTAPkjhUbxX5vEVlZcIhNQmNB0ze_hovUw';

export interface Payee {
  id: string;
  name: string;
  image: string;
}

export const PAYEES: Payee[] = [
  {
    id: '1',
    name: 'Priya Sharma',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAfyT3UT_op-sHBXbUGCKL3ZGr9G1fZG-FZ-2M-NW0tpJ6oerySTSMgEfv1_odRPsJrBYkWxflGubhratlvQrRyTNRaMMsxNqhNIEuKk7gQIZueobNOILrllWk633Ji1RmA9-yBGq_Qxzc7Ua-4UYhQNoqJp_NpMWmXYVv80sT2LiioCNlzBoZBg8bpSQOwZKtfZTD6TVYgdUBvHWm7bf2jdb0UXC_GWJqE77RAIl-bgEVEchN4QMSq_JCg7l6ELUkKxd5Cd-DHWnCo',
  },
  {
    id: '2',
    name: 'Ravi Kumar',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAC1FicObCh0HS6f2za2NOcFFWk24ajeCD0FXmHqrSWs_4pjI0CLnWCPWeIFpdHwEEi3xhNIQnznIJFQWHd6Hl5v2ifBqbEBgnzfbgy9SVn9YhW6UC9Rw11Vc445PnmySAluZIgnMdljl9FijD0bAIjMuKGLDmC9az-y0y07UZME1-EEgdNKpjVtN-UIsS73DAIiFkFf6rA8rz_Mh2ae8t1g0niHV1e5iF9n2xiqe9sCDvw-IZBDOC9Ur9DtlZwLPDYiJZurm3l2c1S',
  },
  {
    id: '3',
    name: 'Anjali Desai',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuB5xnSJdvFWl6cPlBOZnryIMvRdyIdcnuIsgTf82R29V3uGQNqlAh8PLDzBGwbFL1IAbF5Cv84q52CGbXKnmH9knrledqasFWPhXA5yNXL7NMVpuT9LvSKsxyJooZSjv-8VAIyQPEm74cEtCnbB6GR9oxz-1yNMwvxqyh2cphk34EEhRzlL1yVXdYbVfjswhODbjZT9-Aje2FTzKmpVoEBu0KvPdt9PrShqh-4XXLY7bufstbmIHiDY_QgzIiWGdpwhxzcpyF958swN',
  },
  {
    id: '4',
    name: 'Arjun Singh',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDY_kqX5eaWPevvkdsFx9nQa4PSS70ogLQ0mFr-HJw_jK3eUqYC7--vxDsBUkTv4ofkkl2QiAq2XnhvAPbi1t2sScH_j3m2JBtVvSxPwKMVpUBj7S5uQX8ESTH00KswuCMs924cZcQxDh6rUQ2zIf_grGXxYDqs7r__f3o8ITYMu4E8MHPsQn2RH3dSpIBOywcmMvfRHnfjEZgeO2wS30o_n6MMHL6cTD9HCBPClGwSX_3vbuSpzoLAikKSI3q4hUGLsB2d8lBQihK1',
  },
];

export const RECENT_TRANSACTIONS = [
  {
    id: '1',
    name: 'Big Bazaar',
    amount: '-₹84.50',
    category: 'Groceries',
    date: 'Today, 2:45 PM',
    icon: 'shopping-cart',
    iconBg: '#FF8533',
    isPositive: false,
  },
  {
    id: '2',
    name: 'Netflix',
    amount: '-₹15.99',
    category: 'Entertainment',
    date: 'Yesterday, 8:00 AM',
    icon: 'movie',
    iconBg: '#79746f',
    isPositive: false,
  },
  {
    id: '3',
    name: 'Salary',
    amount: '+₹4,250.00',
    category: 'Income',
    date: 'Oct 25, 9:00 AM',
    icon: 'work',
    iconBg: '#b5ccfe',
    isPositive: true,
  },
];

export function formatCurrency(value: number): string {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
