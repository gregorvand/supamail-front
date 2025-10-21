// Centralized access to environment variables used in the frontend

export const aliasDomain = import.meta.env.VITE_ALIAS_DOMAIN || 'webhookmail.mmoat.io';

// Storage bucket for email attachments
export const attachmentsBucket = import.meta.env.VITE_ATTACHMENTS_BUCKET || 'email-attachments';


