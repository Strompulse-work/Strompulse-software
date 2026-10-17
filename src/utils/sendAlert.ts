import { supabase } from '../config/supabase';

/**
 * Triggers an alert which automatically fires the Supabase Push Notification Webhook.
 * 
 * @param type 'emergency' | 'journey_start'
 * @param title The title of the notification (e.g., "SOS from Taiwo")
 * @param message The body text of the notification
 * @param recipientPhones Array of phone numbers to notify
 */
export async function sendPushAlert(
  type: 'emergency' | 'journey_start', 
  title: string, 
  message: string, 
  recipientPhones: string[]
) {
  try {
    // 1. Get the SENDER'S user_id to satisfy Row-Level Security
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error("No user logged in to send alert.");
      return false;
    }

    // 2. Insert ONE row with the sender's ID and the recipients' phone numbers
    const { error } = await supabase
      .from('alerts')
      .insert([
        {
          type: type,
          title: title,
          message: message,
          user_id: user.id, // SENDER'S ID stops the UUID and RLS crashes
          recipient_phones: recipientPhones 
        }
      ]);

    if (error) {
      console.error('Failed to trigger alert:', error.message);
      return false;
    }
    
    console.log('Alert saved to database. Webhook must now process recipient_phones.');
    return true;
  } catch (err) {
    console.error('Unexpected error sending alert:', err);
    return false;
  }
}