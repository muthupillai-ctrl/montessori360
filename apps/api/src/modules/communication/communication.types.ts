export type Audience      = 'all' | 'staff' | 'parents' | 'class';
export type SenderType    = 'staff' | 'parent';
export type RecipientType = 'staff' | 'parent';

// ── DB rows ───────────────────────────────────────────────────────────────────

export interface Attachment {
  name:  string;
  url:   string;
  type:  string;   // mime type
  size?: number;
}

export interface AnnouncementRow {
  id:           string;
  title:        string;
  body:         string;
  audience:     Audience;
  class_ids:    string[];
  attachments:  Attachment[];
  published_at: Date | null;
  expires_at:   Date | null;
  created_by:   string | null;
  created_at:   Date;
  updated_at:   Date;
  // Joined
  author_name?:         string;
  acknowledged_count?:  number;
  total_recipients?:    number;
}

export interface CircularRow {
  id:              string;
  title:           string;
  body:            string;
  audience:        Audience;
  class_ids:       string[];
  attachments:     Attachment[];
  requires_ack:    boolean;
  published_at:    Date | null;
  expires_at:      Date | null;
  created_by:      string | null;
  created_at:      Date;
  updated_at:      Date;
  // Joined
  author_name?:         string;
  acknowledged_count?:  number;
  total_recipients?:    number;
}

export interface AcknowledgementRow {
  id:             string;
  circular_id:    string;
  acknowledged_by: string;
  acknowledger_type: SenderType;
  acknowledged_at: Date;
}

export interface MessageRow {
  id:             string;
  sender_id:      string;
  sender_type:    SenderType;
  recipient_id:   string;
  recipient_type: RecipientType;
  body:           string;
  attachments:    Attachment[];
  is_read:        boolean;
  read_at:        Date | null;
  created_at:     Date;
  // Joined
  sender_name?:    string;
  recipient_name?: string;
}

export interface ConversationSummary {
  partner_id:    string;
  partner_name:  string;
  partner_type:  SenderType;
  last_message:  string;
  last_message_at: Date;
  unread_count:  number;
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface CreateAnnouncementDto {
  title:        string;
  body:         string;
  audience:     Audience;
  class_ids?:   string[];
  attachments?: Attachment[];
  publish_now?: boolean;
  expires_at?:  string;
}

export interface CreateCircularDto {
  title:        string;
  body:         string;
  audience:     Audience;
  class_ids?:   string[];
  attachments?: Attachment[];
  requires_ack?: boolean;
  publish_now?: boolean;
  expires_at?:  string;
}

export interface SendMessageDto {
  recipient_id:   string;
  recipient_type: RecipientType;
  body:           string;
  attachments?:   Attachment[];
}

export interface AnnouncementFilters {
  audience?:   Audience;
  class_id?:   string;
  published?:  boolean;
  page?:       number;
  limit?:      number;
}

export interface MessageFilters {
  partner_id?:   string;
  partner_type?: SenderType;
  unread_only?:  boolean;
  page?:         number;
  limit?:        number;
}
