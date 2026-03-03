// scripts/cron.mjs
// Run this alongside your Next.js dev server to fire reminders at 5:30 PM IST daily
// Start it with: node scripts/cron.mjs

import cron from 'node-cron'
import fetch from 'node-fetch'

const API_URL = 'http://localhost:3000/api/send-reminders'

console.log('⏰ Reminder cron started — will fire every day at 5:30 PM IST')

// 5:30 PM IST = 12:00 UTC
cron.schedule('0 12 * * *', async () => {
  console.log(`[${new Date().toISOString()}] Firing reminder emails...`)
  try {
    const res = await fetch(API_URL)
    const data = await res.json()
    console.log('✅ Done:', data)
  } catch (err) {
    console.error('❌ Failed to send reminders:', err)
  }
}, {
  timezone: 'UTC'
})

console.log('Waiting... (runs daily at 12:00 UTC = 5:30 PM IST)')

// Keep the process alive
process.on('SIGINT', () => {
  console.log('\nCron stopped.')
  process.exit(0)
})
