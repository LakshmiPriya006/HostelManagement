import { supabase } from './supabase';
import type { NotificationType, UserRole } from '../types';

export async function createNotification(
  userId: string,
  userRole: UserRole,
  type: NotificationType,
  message: string,
  referenceId?: string
) {
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    user_role: userRole,
    type,
    message,
    reference_id: referenceId || null,
  });
  return { error };
}

export async function sendRentReminder(
  hostellerIds: string[],
  message: string
) {
  const notifications = hostellerIds.map(id => ({
    user_id: id,
    user_role: 'hosteller' as UserRole,
    type: 'rent_reminder' as NotificationType,
    message,
  }));

  const { error } = await supabase.from('notifications').insert(notifications);
  return { error };
}

export async function sendAnnouncementNotification(
  hostellerIds: string[],
  announcementId: string,
  title: string
) {
  const notifications = hostellerIds.map(id => ({
    user_id: id,
    user_role: 'hosteller' as UserRole,
    type: 'announcement' as NotificationType,
    message: `New announcement: ${title}`,
    reference_id: announcementId,
  }));

  const { error } = await supabase.from('notifications').insert(notifications);
  return { error };
}

export async function sendFeedbackNotification(
  hostellerIds: string[],
  formId: string,
  title: string
) {
  const notifications = hostellerIds.map(id => ({
    user_id: id,
    user_role: 'hosteller' as UserRole,
    type: 'feedback_request' as NotificationType,
    message: `New feedback form: ${title}`,
    reference_id: formId,
  }));

  const { error } = await supabase.from('notifications').insert(notifications);
  return { error };
}
