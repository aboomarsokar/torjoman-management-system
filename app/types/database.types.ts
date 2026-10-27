export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_alerts: {
        Row: {
          acknowledged_at: string | null
          alert_date: string
          created_at: string
          description: string | null
          id: string
          issuer_id: string
          severity: Database["public"]["Enums"]["alert_severity"]
          status: Database["public"]["Enums"]["alert_status"]
          teacher_id: string
          updated_at: string
          violation_type: string
        }
        Insert: {
          acknowledged_at?: string | null
          alert_date?: string
          created_at?: string
          description?: string | null
          id?: string
          issuer_id: string
          severity?: Database["public"]["Enums"]["alert_severity"]
          status?: Database["public"]["Enums"]["alert_status"]
          teacher_id: string
          updated_at?: string
          violation_type: string
        }
        Update: {
          acknowledged_at?: string | null
          alert_date?: string
          created_at?: string
          description?: string | null
          id?: string
          issuer_id?: string
          severity?: Database["public"]["Enums"]["alert_severity"]
          status?: Database["public"]["Enums"]["alert_status"]
          teacher_id?: string
          updated_at?: string
          violation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_alerts_issuer_id_fkey"
            columns: ["issuer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_alerts_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          created_at: string
          id: number
          pass_mark: number
          reading_pass_mark: number
          reading_retry_days: number
          reading_test_minutes: number
          reading_test_questions: number
          target_memorization_pages: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          pass_mark?: number
          reading_pass_mark?: number
          reading_retry_days?: number
          reading_test_minutes?: number
          reading_test_questions?: number
          target_memorization_pages?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          pass_mark?: number
          reading_pass_mark?: number
          reading_retry_days?: number
          reading_test_minutes?: number
          reading_test_questions?: number
          target_memorization_pages?: number
          updated_at?: string
        }
        Relationships: []
      }
      attendance_absences: {
        Row: {
          created_at: string
          day: string
          halaqa_id: string
          kind: string
          recorded_by: string | null
          student_id: string
        }
        Insert: {
          created_at?: string
          day: string
          halaqa_id: string
          kind: string
          recorded_by?: string | null
          student_id: string
        }
        Update: {
          created_at?: string
          day?: string
          halaqa_id?: string
          kind?: string
          recorded_by?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_absences_halaqa_id_day_fkey"
            columns: ["halaqa_id", "day"]
            isOneToOne: false
            referencedRelation: "attendance_days"
            referencedColumns: ["halaqa_id", "day"]
          },
          {
            foreignKeyName: "attendance_absences_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_absences_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_days: {
        Row: {
          created_at: string
          day: string
          halaqa_id: string
          recorded_at: string | null
          recorded_by: string | null
        }
        Insert: {
          created_at?: string
          day: string
          halaqa_id: string
          recorded_at?: string | null
          recorded_by?: string | null
        }
        Update: {
          created_at?: string
          day?: string
          halaqa_id?: string
          recorded_at?: string | null
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_days_halaqa_id_fkey"
            columns: ["halaqa_id"]
            isOneToOne: false
            referencedRelation: "halaqat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_days_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booklet_deliveries: {
        Row: {
          booklet: number
          copies: number
          created_at: string
          created_by: string | null
          delivered_on: string
          halaqa_id: string
          id: string
          note: string | null
        }
        Insert: {
          booklet: number
          copies: number
          created_at?: string
          created_by?: string | null
          delivered_on?: string
          halaqa_id: string
          id?: string
          note?: string | null
        }
        Update: {
          booklet?: number
          copies?: number
          created_at?: string
          created_by?: string | null
          delivered_on?: string
          halaqa_id?: string
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booklet_deliveries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booklet_deliveries_halaqa_id_fkey"
            columns: ["halaqa_id"]
            isOneToOne: false
            referencedRelation: "halaqat"
            referencedColumns: ["id"]
          },
        ]
      }
      booklet_requests: {
        Row: {
          booklet: number
          closed_at: string | null
          copies: number
          created_at: string
          halaqa_id: string
          id: string
          note: string | null
          requested_by: string
          status: string
        }
        Insert: {
          booklet: number
          closed_at?: string | null
          copies: number
          created_at?: string
          halaqa_id: string
          id?: string
          note?: string | null
          requested_by?: string
          status?: string
        }
        Update: {
          booklet?: number
          closed_at?: string | null
          copies?: number
          created_at?: string
          halaqa_id?: string
          id?: string
          note?: string | null
          requested_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "booklet_requests_halaqa_id_fkey"
            columns: ["halaqa_id"]
            isOneToOne: false
            referencedRelation: "halaqat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booklet_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_cycles: {
        Row: {
          created_at: string
          cycle_number: number
          id: number
          parts_from: number
          parts_to: number
          sort_order: number | null
          stage_number: number
          surahs_label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cycle_number: number
          id: number
          parts_from: number
          parts_to: number
          sort_order?: number | null
          stage_number: number
          surahs_label: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cycle_number?: number
          id?: number
          parts_from?: number
          parts_to?: number
          sort_order?: number | null
          stage_number?: number
          surahs_label?: string
          updated_at?: string
        }
        Relationships: []
      }
      exam_list_items: {
        Row: {
          created_at: string
          exam_cycle_id: number
          exam_list_id: string
          id: string
          student_id: string
          teacher_note: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          exam_cycle_id: number
          exam_list_id: string
          id?: string
          student_id: string
          teacher_note?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          exam_cycle_id?: number
          exam_list_id?: string
          id?: string
          student_id?: string
          teacher_note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_list_items_exam_cycle_id_fkey"
            columns: ["exam_cycle_id"]
            isOneToOne: false
            referencedRelation: "exam_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_list_items_exam_list_id_fkey"
            columns: ["exam_list_id"]
            isOneToOne: false
            referencedRelation: "exam_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_list_items_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_lists: {
        Row: {
          created_at: string
          halaqa_id: string
          id: string
          status: Database["public"]["Enums"]["exam_list_status"]
          teacher_id: string
          updated_at: string
          week_date: string
        }
        Insert: {
          created_at?: string
          halaqa_id: string
          id?: string
          status?: Database["public"]["Enums"]["exam_list_status"]
          teacher_id: string
          updated_at?: string
          week_date: string
        }
        Update: {
          created_at?: string
          halaqa_id?: string
          id?: string
          status?: Database["public"]["Enums"]["exam_list_status"]
          teacher_id?: string
          updated_at?: string
          week_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_lists_halaqa_id_fkey"
            columns: ["halaqa_id"]
            isOneToOne: false
            referencedRelation: "halaqat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_lists_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_results: {
        Row: {
          created_at: string
          exam_date: string
          exam_list_item_id: string | null
          examiner_id: string | null
          id: string
          notes: string | null
          pass_mark_snapshot: number
          passed: boolean | null
          q1_memorization: number
          q1_reflection: number
          q1_understanding: number
          q2_memorization: number
          q2_reflection: number
          q2_understanding: number
          q3_memorization: number
          q3_reflection: number
          q3_understanding: number
          student_id: string
          tajweed_score: number
          total_score: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          exam_date?: string
          exam_list_item_id?: string | null
          examiner_id?: string | null
          id?: string
          notes?: string | null
          pass_mark_snapshot: number
          passed?: boolean | null
          q1_memorization?: number
          q1_reflection?: number
          q1_understanding?: number
          q2_memorization?: number
          q2_reflection?: number
          q2_understanding?: number
          q3_memorization?: number
          q3_reflection?: number
          q3_understanding?: number
          student_id: string
          tajweed_score?: number
          total_score?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          exam_date?: string
          exam_list_item_id?: string | null
          examiner_id?: string | null
          id?: string
          notes?: string | null
          pass_mark_snapshot?: number
          passed?: boolean | null
          q1_memorization?: number
          q1_reflection?: number
          q1_understanding?: number
          q2_memorization?: number
          q2_reflection?: number
          q2_understanding?: number
          q3_memorization?: number
          q3_reflection?: number
          q3_understanding?: number
          student_id?: string
          tajweed_score?: number
          total_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_results_exam_list_item_id_fkey"
            columns: ["exam_list_item_id"]
            isOneToOne: false
            referencedRelation: "exam_list_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_examiner_id_fkey"
            columns: ["examiner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          source_key: string | null
          transaction_date: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          source_key?: string | null
          transaction_date?: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          source_key?: string | null
          transaction_date?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      halaqa_incentives: {
        Row: {
          allocated_amount: number
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          created_at: string
          halaqa_id: string
          id: string
          incentive_month: number
          incentive_year: number
          updated_at: string
        }
        Insert: {
          allocated_amount?: number
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          halaqa_id: string
          id?: string
          incentive_month: number
          incentive_year: number
          updated_at?: string
        }
        Update: {
          allocated_amount?: number
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          halaqa_id?: string
          id?: string
          incentive_month?: number
          incentive_year?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "halaqa_incentives_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "halaqa_incentives_halaqa_id_fkey"
            columns: ["halaqa_id"]
            isOneToOne: false
            referencedRelation: "halaqat"
            referencedColumns: ["id"]
          },
        ]
      }
      halaqat: {
        Row: {
          assigned_by: string | null
          classification:
            | Database["public"]["Enums"]["halaqa_classification"]
            | null
          created_at: string
          daily_time: string | null
          examiner_assigned_at: string | null
          examiner_assigned_by: string | null
          examiner_id: string | null
          gender: Database["public"]["Enums"]["gender_type"] | null
          id: string
          name: string
          status: Database["public"]["Enums"]["halaqa_status"]
          supervisor_id: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          classification?:
            | Database["public"]["Enums"]["halaqa_classification"]
            | null
          created_at?: string
          daily_time?: string | null
          examiner_assigned_at?: string | null
          examiner_assigned_by?: string | null
          examiner_id?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["halaqa_status"]
          supervisor_id?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          classification?:
            | Database["public"]["Enums"]["halaqa_classification"]
            | null
          created_at?: string
          daily_time?: string | null
          examiner_assigned_at?: string | null
          examiner_assigned_by?: string | null
          examiner_id?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["halaqa_status"]
          supervisor_id?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "halaqat_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "halaqat_examiner_assigned_by_fkey"
            columns: ["examiner_assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "halaqat_examiner_id_fkey"
            columns: ["examiner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "halaqat_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "halaqat_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_sessions: {
        Row: {
          actor_name: string
          actor_profile_id: string | null
          actor_role: Database["public"]["Enums"]["user_role"]
          ended_at: string | null
          ended_reason: string | null
          expires_at: string
          return_to: string | null
          session_id: string
          started_at: string
          target_name: string
          target_profile_id: string | null
          write_until: string | null
        }
        Insert: {
          actor_name: string
          actor_profile_id?: string | null
          actor_role: Database["public"]["Enums"]["user_role"]
          ended_at?: string | null
          ended_reason?: string | null
          expires_at: string
          return_to?: string | null
          session_id: string
          started_at?: string
          target_name: string
          target_profile_id?: string | null
          write_until?: string | null
        }
        Update: {
          actor_name?: string
          actor_profile_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"]
          ended_at?: string | null
          ended_reason?: string | null
          expires_at?: string
          return_to?: string | null
          session_id?: string
          started_at?: string
          target_name?: string
          target_profile_id?: string | null
          write_until?: string | null
        }
        Relationships: []
      }
      impersonation_writes: {
        Row: {
          actor_profile_id: string | null
          id: number
          new_row: Json | null
          occurred_at: string
          old_row: Json | null
          op: string
          route: string | null
          session_id: string
          table_name: string | null
          target_profile_id: string | null
        }
        Insert: {
          actor_profile_id?: string | null
          id?: never
          new_row?: Json | null
          occurred_at?: string
          old_row?: Json | null
          op: string
          route?: string | null
          session_id: string
          table_name?: string | null
          target_profile_id?: string | null
        }
        Update: {
          actor_profile_id?: string | null
          id?: never
          new_row?: Json | null
          occurred_at?: string
          old_row?: Json | null
          op?: string
          route?: string | null
          session_id?: string
          table_name?: string | null
          target_profile_id?: string | null
        }
        Relationships: []
      }
      incentive_statement_items: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string
          id: string
          item_date: string
          statement_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          description: string
          id?: string
          item_date: string
          statement_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          item_date?: string
          statement_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incentive_statement_items_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "incentive_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      incentive_statements: {
        Row: {
          created_at: string
          created_by: string | null
          halaqa_id: string
          id: string
          received_amount: number
          return_note: string | null
          returned_at: string | null
          returned_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          statement_month: number
          statement_year: number
          status: Database["public"]["Enums"]["statement_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          halaqa_id: string
          id?: string
          received_amount?: number
          return_note?: string | null
          returned_at?: string | null
          returned_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          statement_month: number
          statement_year: number
          status?: Database["public"]["Enums"]["statement_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          halaqa_id?: string
          id?: string
          received_amount?: number
          return_note?: string | null
          returned_at?: string | null
          returned_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          statement_month?: number
          statement_year?: number
          status?: Database["public"]["Enums"]["statement_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incentive_statements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incentive_statements_halaqa_id_fkey"
            columns: ["halaqa_id"]
            isOneToOne: false
            referencedRelation: "halaqat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incentive_statements_returned_by_fkey"
            columns: ["returned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incentive_statements_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_minutes: {
        Row: {
          agenda: string | null
          attachments: Json | null
          attendee_ids: string[]
          created_at: string
          created_by: string | null
          decisions: string | null
          deferred_items: string | null
          id: string
          meeting_date: string
          status: Database["public"]["Enums"]["minutes_status"]
          tasks: string | null
          title: string
          updated_at: string
        }
        Insert: {
          agenda?: string | null
          attachments?: Json | null
          attendee_ids?: string[]
          created_at?: string
          created_by?: string | null
          decisions?: string | null
          deferred_items?: string | null
          id?: string
          meeting_date: string
          status?: Database["public"]["Enums"]["minutes_status"]
          tasks?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          agenda?: string | null
          attachments?: Json | null
          attendee_ids?: string[]
          created_at?: string
          created_by?: string | null
          decisions?: string | null
          deferred_items?: string | null
          id?: string
          meeting_date?: string
          status?: Database["public"]["Enums"]["minutes_status"]
          tasks?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_minutes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_reports: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          halaqa_id: string
          id: string
          report_month: number
          report_year: number
          return_note: string | null
          status: Database["public"]["Enums"]["report_status"]
          submitted_at: string | null
          target_pages_snapshot: number | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          halaqa_id: string
          id?: string
          report_month: number
          report_year: number
          return_note?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          submitted_at?: string | null
          target_pages_snapshot?: number | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          halaqa_id?: string
          id?: string
          report_month?: number
          report_year?: number
          return_note?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          submitted_at?: string | null
          target_pages_snapshot?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_reports_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_reports_halaqa_id_fkey"
            columns: ["halaqa_id"]
            isOneToOne: false
            referencedRelation: "halaqat"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_salaries: {
        Row: {
          amount: number
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          profile_id: string
          salary_month: number
          salary_year: number
          updated_at: string
        }
        Insert: {
          amount?: number
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          profile_id: string
          salary_month: number
          salary_year: number
          updated_at?: string
        }
        Update: {
          amount?: number
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          profile_id?: string
          salary_month?: number
          salary_year?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_salaries_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_salaries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      news: {
        Row: {
          body: string | null
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          image_url: string | null
          news_date: string
          published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          news_date?: string
          published?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          news_date?: string
          published?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          recipient_id: string
          source_id: string | null
          source_table: string | null
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          recipient_id: string
          source_id?: string | null
          source_table?: string | null
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          recipient_id?: string
          source_id?: string | null
          source_table?: string | null
          title?: string
        }
        Relationships: []
      }
      profile_financials: {
        Row: {
          account_holder: string | null
          account_number: string | null
          account_type: Database["public"]["Enums"]["account_type"] | null
          created_at: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          account_holder?: string | null
          account_number?: string | null
          account_type?: Database["public"]["Enums"]["account_type"] | null
          created_at?: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          account_holder?: string | null
          account_number?: string | null
          account_type?: Database["public"]["Enums"]["account_type"] | null
          created_at?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_financials_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          academic_major: string | null
          address_detail: string | null
          assigned_by: string | null
          avatar_url: string | null
          birth_date: string | null
          created_at: string
          education_level: string | null
          email: string | null
          employee_number: string | null
          family_count: number | null
          full_name: string
          gender: Database["public"]["Enums"]["gender_type"] | null
          hire_date: string | null
          id: string
          job_title: string | null
          marital_status: string | null
          must_change_password: boolean
          national_id: string | null
          nearest_mosque: string | null
          phone: string | null
          photo_path: string | null
          quran_parts: number | null
          residence_area: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["profile_status"]
          tajweed_level: string | null
          updated_at: string
          whatsapp: string | null
          years_experience: number | null
        }
        Insert: {
          academic_major?: string | null
          address_detail?: string | null
          assigned_by?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          education_level?: string | null
          email?: string | null
          employee_number?: string | null
          family_count?: number | null
          full_name: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          hire_date?: string | null
          id: string
          job_title?: string | null
          marital_status?: string | null
          must_change_password?: boolean
          national_id?: string | null
          nearest_mosque?: string | null
          phone?: string | null
          photo_path?: string | null
          quran_parts?: number | null
          residence_area?: string | null
          role: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["profile_status"]
          tajweed_level?: string | null
          updated_at?: string
          whatsapp?: string | null
          years_experience?: number | null
        }
        Update: {
          academic_major?: string | null
          address_detail?: string | null
          assigned_by?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          education_level?: string | null
          email?: string | null
          employee_number?: string | null
          family_count?: number | null
          full_name?: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          hire_date?: string | null
          id?: string
          job_title?: string | null
          marital_status?: string | null
          must_change_password?: boolean
          national_id?: string | null
          nearest_mosque?: string | null
          phone?: string | null
          photo_path?: string | null
          quran_parts?: number | null
          residence_area?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["profile_status"]
          tajweed_level?: string | null
          updated_at?: string
          whatsapp?: string | null
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      program_juz: {
        Row: {
          end_ayah: number
          end_surah: number
          number: number
          start_ayah: number
          start_surah: number
        }
        Insert: {
          end_ayah: number
          end_surah: number
          number: number
          start_ayah: number
          start_surah: number
        }
        Update: {
          end_ayah?: number
          end_surah?: number
          number?: number
          start_ayah?: number
          start_surah?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_juz_end_surah_fkey"
            columns: ["end_surah"]
            isOneToOne: false
            referencedRelation: "surahs"
            referencedColumns: ["number"]
          },
          {
            foreignKeyName: "program_juz_start_surah_fkey"
            columns: ["start_surah"]
            isOneToOne: false
            referencedRelation: "surahs"
            referencedColumns: ["number"]
          },
        ]
      }
      quran_pages: {
        Row: {
          ayah: number
          page: number
          surah: number
        }
        Insert: {
          ayah: number
          page: number
          surah: number
        }
        Update: {
          ayah?: number
          page?: number
          surah?: number
        }
        Relationships: [
          {
            foreignKeyName: "quran_pages_surah_fkey"
            columns: ["surah"]
            isOneToOne: false
            referencedRelation: "surahs"
            referencedColumns: ["number"]
          },
        ]
      }
      quran_records: {
        Row: {
          created_at: string
          from_ayah: number | null
          from_surah: number | null
          id: string
          notes: string | null
          pages_memorized: number
          pages_reviewed: number | null
          recorded_by: string | null
          report_id: string
          student_id: string
          to_ayah: number | null
          to_surah: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_ayah?: number | null
          from_surah?: number | null
          id?: string
          notes?: string | null
          pages_memorized?: number
          pages_reviewed?: number | null
          recorded_by?: string | null
          report_id: string
          student_id: string
          to_ayah?: number | null
          to_surah?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_ayah?: number | null
          from_surah?: number | null
          id?: string
          notes?: string | null
          pages_memorized?: number
          pages_reviewed?: number | null
          recorded_by?: string | null
          report_id?: string
          student_id?: string
          to_ayah?: number | null
          to_surah?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quran_records_from_surah_fkey"
            columns: ["from_surah"]
            isOneToOne: false
            referencedRelation: "surahs"
            referencedColumns: ["number"]
          },
          {
            foreignKeyName: "quran_records_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quran_records_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "monthly_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quran_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quran_records_to_surah_fkey"
            columns: ["to_surah"]
            isOneToOne: false
            referencedRelation: "surahs"
            referencedColumns: ["number"]
          },
        ]
      }
      reading_attempts: {
        Row: {
          answers: Json | null
          deadline_at: string
          id: string
          passed: boolean | null
          percent: number | null
          question_ids: number[]
          score: number | null
          started_at: string
          student_id: string
          submitted_at: string | null
          total: number
          unit_id: number
        }
        Insert: {
          answers?: Json | null
          deadline_at: string
          id?: string
          passed?: boolean | null
          percent?: number | null
          question_ids: number[]
          score?: number | null
          started_at?: string
          student_id: string
          submitted_at?: string | null
          total: number
          unit_id: number
        }
        Update: {
          answers?: Json | null
          deadline_at?: string
          id?: string
          passed?: boolean | null
          percent?: number | null
          question_ids?: number[]
          score?: number | null
          started_at?: string
          student_id?: string
          submitted_at?: string | null
          total?: number
          unit_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "reading_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_attempts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "reading_units"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_books: {
        Row: {
          author: string | null
          created_at: string
          description: string | null
          id: number
          pages: number | null
          title: string
        }
        Insert: {
          author?: string | null
          created_at?: string
          description?: string | null
          id?: never
          pages?: number | null
          title: string
        }
        Update: {
          author?: string | null
          created_at?: string
          description?: string | null
          id?: never
          pages?: number | null
          title?: string
        }
        Relationships: []
      }
      reading_questions: {
        Row: {
          active: boolean
          body: string
          correct: number
          created_at: string
          id: number
          options: string[]
          unit_id: number
        }
        Insert: {
          active?: boolean
          body: string
          correct: number
          created_at?: string
          id?: never
          options: string[]
          unit_id: number
        }
        Update: {
          active?: boolean
          body?: string
          correct?: number
          created_at?: string
          id?: never
          options?: string[]
          unit_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "reading_questions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "reading_units"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_unit_parts: {
        Row: {
          book_id: number
          id: number
          page_from: number
          page_to: number
          sort_order: number
          unit_id: number
        }
        Insert: {
          book_id: number
          id?: never
          page_from: number
          page_to: number
          sort_order?: number
          unit_id: number
        }
        Update: {
          book_id?: number
          id?: never
          page_from?: number
          page_to?: number
          sort_order?: number
          unit_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "reading_unit_parts_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "reading_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_unit_parts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "reading_units"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_units: {
        Row: {
          cover_path: string | null
          created_at: string
          id: number
          pdf_path: string | null
          sort_order: number
          title: string
        }
        Insert: {
          cover_path?: string | null
          created_at?: string
          id?: never
          pdf_path?: string | null
          sort_order: number
          title: string
        }
        Update: {
          cover_path?: string | null
          created_at?: string
          id?: never
          pdf_path?: string | null
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      staff_message_recipients: {
        Row: {
          message_id: string
          recipient_id: string
          seen_at: string | null
        }
        Insert: {
          message_id: string
          recipient_id: string
          seen_at?: string | null
        }
        Update: {
          message_id?: string
          recipient_id?: string
          seen_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_message_recipients_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "staff_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_message_recipients_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_messages: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          recipients: number
          roles: string[] | null
          section: string | null
          sent_by: string
          target_id: string | null
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          recipients?: number
          roles?: string[] | null
          section?: string | null
          sent_by?: string
          target_id?: string | null
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          recipients?: number
          roles?: string[] | null
          section?: string | null
          sent_by?: string
          target_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_messages_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_messages_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_requests: {
        Row: {
          birth_date: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          full_name: string
          guardian_phone: string | null
          halaqa_id: string
          id: string
          national_id: string
          nearest_mosque: string | null
          note: string | null
          reject_note: string | null
          requested_by: string
          residence: string | null
          status: string
          student_id: string | null
          tajweed_level: string | null
        }
        Insert: {
          birth_date?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          full_name: string
          guardian_phone?: string | null
          halaqa_id: string
          id?: string
          national_id: string
          nearest_mosque?: string | null
          note?: string | null
          reject_note?: string | null
          requested_by?: string
          residence?: string | null
          status?: string
          student_id?: string | null
          tajweed_level?: string | null
        }
        Update: {
          birth_date?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          full_name?: string
          guardian_phone?: string | null
          halaqa_id?: string
          id?: string
          national_id?: string
          nearest_mosque?: string | null
          note?: string | null
          reject_note?: string | null
          requested_by?: string
          residence?: string | null
          status?: string
          student_id?: string | null
          tajweed_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_requests_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_requests_halaqa_id_fkey"
            columns: ["halaqa_id"]
            isOneToOne: false
            referencedRelation: "halaqat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          avatar_url: string | null
          birth_date: string | null
          created_at: string
          created_by: string | null
          enrollment_date: string | null
          family_count: number | null
          full_name: string
          gender: Database["public"]["Enums"]["gender_type"] | null
          guardian_email: string | null
          guardian_name: string | null
          guardian_phone: string | null
          halaqa_id: string | null
          id: string
          national_id: string | null
          nearest_mosque: string | null
          phone: string | null
          quran_parts: number | null
          residence: string | null
          status: Database["public"]["Enums"]["student_status"]
          tajweed_level: string | null
          updated_at: string
          user_id: string | null
          view_token: string
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          created_by?: string | null
          enrollment_date?: string | null
          family_count?: number | null
          full_name: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          guardian_email?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          halaqa_id?: string | null
          id?: string
          national_id?: string | null
          nearest_mosque?: string | null
          phone?: string | null
          quran_parts?: number | null
          residence?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          tajweed_level?: string | null
          updated_at?: string
          user_id?: string | null
          view_token?: string
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          created_by?: string | null
          enrollment_date?: string | null
          family_count?: number | null
          full_name?: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          guardian_email?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          halaqa_id?: string | null
          id?: string
          national_id?: string | null
          nearest_mosque?: string | null
          phone?: string | null
          quran_parts?: number | null
          residence?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          tajweed_level?: string | null
          updated_at?: string
          user_id?: string | null
          view_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_halaqa_id_fkey"
            columns: ["halaqa_id"]
            isOneToOne: false
            referencedRelation: "halaqat"
            referencedColumns: ["id"]
          },
        ]
      }
      supervision_visits: {
        Row: {
          created_at: string
          criteria_scores: number[] | null
          deductions: Json | null
          executed_at: string | null
          flow_rating: string | null
          halaqa_id: string
          id: string
          improvements: string | null
          locked_at: string | null
          notes: string | null
          recommendations: string | null
          scheduled_at: string
          score: number | null
          status: Database["public"]["Enums"]["visit_status"]
          strengths: string | null
          supervisor_id: string
          teacher_ack_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          criteria_scores?: number[] | null
          deductions?: Json | null
          executed_at?: string | null
          flow_rating?: string | null
          halaqa_id: string
          id?: string
          improvements?: string | null
          locked_at?: string | null
          notes?: string | null
          recommendations?: string | null
          scheduled_at: string
          score?: number | null
          status?: Database["public"]["Enums"]["visit_status"]
          strengths?: string | null
          supervisor_id: string
          teacher_ack_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          criteria_scores?: number[] | null
          deductions?: Json | null
          executed_at?: string | null
          flow_rating?: string | null
          halaqa_id?: string
          id?: string
          improvements?: string | null
          locked_at?: string | null
          notes?: string | null
          recommendations?: string | null
          scheduled_at?: string
          score?: number | null
          status?: Database["public"]["Enums"]["visit_status"]
          strengths?: string | null
          supervisor_id?: string
          teacher_ack_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supervision_visits_halaqa_id_fkey"
            columns: ["halaqa_id"]
            isOneToOne: false
            referencedRelation: "halaqat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervision_visits_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      surahs: {
        Row: {
          ayah_count: number
          name: string
          number: number
        }
        Insert: {
          ayah_count: number
          name: string
          number: number
        }
        Update: {
          ayah_count?: number
          name?: string
          number?: number
        }
        Relationships: []
      }
      teacher_quality_months: {
        Row: {
          achievement: number | null
          admin_notes: string | null
          admin_notes_at: string | null
          admin_notes_by: string | null
          created_at: string
          final: number | null
          halaqa_id: string
          id: string
          locked_at: string | null
          meetings_score: number
          month: number
          numbers: Json
          quality: number | null
          supervisor_id: string | null
          supervisor_notes: string | null
          teacher_ack_at: string | null
          teacher_id: string | null
          updated_at: string
          year: number
        }
        Insert: {
          achievement?: number | null
          admin_notes?: string | null
          admin_notes_at?: string | null
          admin_notes_by?: string | null
          created_at?: string
          final?: number | null
          halaqa_id: string
          id?: string
          locked_at?: string | null
          meetings_score: number
          month: number
          numbers: Json
          quality?: number | null
          supervisor_id?: string | null
          supervisor_notes?: string | null
          teacher_ack_at?: string | null
          teacher_id?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          achievement?: number | null
          admin_notes?: string | null
          admin_notes_at?: string | null
          admin_notes_by?: string | null
          created_at?: string
          final?: number | null
          halaqa_id?: string
          id?: string
          locked_at?: string | null
          meetings_score?: number
          month?: number
          numbers?: Json
          quality?: number | null
          supervisor_id?: string | null
          supervisor_notes?: string | null
          teacher_ack_at?: string | null
          teacher_id?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "teacher_quality_months_admin_notes_by_fkey"
            columns: ["admin_notes_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_quality_months_halaqa_id_fkey"
            columns: ["halaqa_id"]
            isOneToOne: false
            referencedRelation: "halaqat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_quality_months_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_quality_months_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string
          size_bytes: number
          storage_path: string
          transaction_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type: string
          size_bytes: number
          storage_path: string
          transaction_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          transaction_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_attachments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_trips: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          notes: string | null
          paid: boolean
          paid_at: string | null
          paid_by: string | null
          profile_id: string
          trip_date: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          id?: string
          notes?: string | null
          paid?: boolean
          paid_at?: string | null
          paid_by?: string | null
          profile_id?: string
          trip_date: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          notes?: string | null
          paid?: boolean
          paid_at?: string | null
          paid_by?: string | null
          profile_id?: string
          trip_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_trips_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_trips_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_deduction_items: {
        Row: {
          criterion: number
          criterion_hint: string | null
          criterion_label: string
          key: string
          label: string
          per_time: number
          sort_order: number
        }
        Insert: {
          criterion: number
          criterion_hint?: string | null
          criterion_label: string
          key: string
          label: string
          per_time: number
          sort_order: number
        }
        Update: {
          criterion?: number
          criterion_hint?: string | null
          criterion_label?: string
          key?: string
          label?: string
          per_time?: number
          sort_order?: number
        }
        Relationships: []
      }
      visit_reschedule_log: {
        Row: {
          changed_at: string
          id: string
          new_time: string | null
          old_time: string | null
          reason: string
          visit_id: string
        }
        Insert: {
          changed_at?: string
          id?: string
          new_time?: string | null
          old_time?: string | null
          reason: string
          visit_id: string
        }
        Update: {
          changed_at?: string
          id?: string
          new_time?: string | null
          old_time?: string | null
          reason?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_reschedule_log_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "supervision_visits"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acknowledge_quality_month: { Args: { p_id: string }; Returns: undefined }
      acknowledge_visit: { Args: { p_visit: string }; Returns: undefined }
      can_approve_in_halaqa: { Args: { hid: string }; Returns: boolean }
      can_approve_report_in_halaqa: { Args: { hid: string }; Returns: boolean }
      can_assign_in_halaqa: { Args: { hid: string }; Returns: boolean }
      can_manage_halaqa: { Args: { hid: string }; Returns: boolean }
      can_manage_profile_photo: { Args: { p_folder: string }; Returns: boolean }
      can_review_statement_in_halaqa: {
        Args: { hid: string }
        Returns: boolean
      }
      can_view_halaqa: { Args: { hid: string }; Returns: boolean }
      can_view_profile_photo: { Args: { p_folder: string }; Returns: boolean }
      can_view_statements_in_halaqa: { Args: { hid: string }; Returns: boolean }
      claim_employee_number: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      deliver_booklet_request: {
        Args: { p_delivered_on: string; p_request: string }
        Returns: string
      }
      end_impersonation_sessions: {
        Args: { p_session_ids: string[] }
        Returns: number
      }
      halaqa_achievement_students: {
        Args: { p_halaqa: string; p_month: number; p_year: number }
        Returns: {
          full_name: string
          pages: number
          required: number
          state: string
          student_id: string
        }[]
      }
      halaqat_achievement: {
        Args: { p_month: number; p_year: number }
        Returns: {
          done: number
          gender: string
          halaqa_id: string
          halaqa_name: string
          report_status: string
          short: number
          students: number
          teacher_id: string
          teacher_name: string
          teacher_phone: string
          teacher_whatsapp: string
          unmeasured: number
          unrecorded: number
        }[]
      }
      halaqat_recording_status: {
        Args: { p_month?: number; p_year?: number }
        Returns: {
          expected_days: number
          gender: string
          halaqa_id: string
          halaqa_name: string
          missed_days: string[]
          recent: Json
          recorded_days: number
          recorded_today: boolean
          report_deadline: string
          report_month: number
          report_status: string
          report_year: number
          teacher_name: string
          teacher_phone: string
          teacher_whatsapp: string
          today: string
        }[]
      }
      in_admin_scope: {
        Args: { g: Database["public"]["Enums"]["gender_type"] }
        Returns: boolean
      }
      is_admin_manager: { Args: never; Returns: boolean }
      is_halaqa_examiner: { Args: { hid: string }; Returns: boolean }
      is_halaqa_supervisor: { Args: { hid: string }; Returns: boolean }
      is_halaqa_teacher: { Args: { hid: string }; Returns: boolean }
      is_project_supervisor: { Args: never; Returns: boolean }
      is_women_admin: { Args: never; Returns: boolean }
      mark_notifications_read: { Args: { p_ids?: string[] }; Returns: number }
      mark_staff_messages_seen: { Args: { p_ids: string[] }; Returns: number }
      my_approved_pages: { Args: never; Returns: number }
      my_exam_cycle_results: {
        Args: never
        Returns: {
          exam_cycle_id: number
          exam_date: string
          passed: boolean
          total_score: number
        }[]
      }
      my_halaqa_id: { Args: never; Returns: string }
      my_quran_months: {
        Args: never
        Returns: {
          from_ayah: number
          from_surah: number
          pages_memorized: number
          pages_reviewed: number
          report_month: number
          report_year: number
          to_ayah: number
          to_surah: number
        }[]
      }
      my_student_id: { Args: never; Returns: string }
      quality_month_preview: {
        Args: { p_halaqa: string; p_month: number; p_year: number }
        Returns: Json
      }
      quran_page_of: {
        Args: { p_ayah: number; p_surah: number }
        Returns: number
      }
      reschedule_visit: {
        Args: { p_new_time: string; p_reason: string; p_visit: string }
        Returns: undefined
      }
      return_statement: {
        Args: { p_note: string; p_statement: string }
        Returns: undefined
      }
      save_attendance_day: {
        Args: {
          p_absences: Json
          p_day: string
          p_halaqa: string
          p_recorded_at?: string
        }
        Returns: Json
      }
      save_quality_month: {
        Args: {
          p_halaqa: string
          p_meetings: number
          p_month: number
          p_notes: string
          p_year: number
        }
        Returns: string
      }
      send_staff_message: {
        Args: {
          p_body: string
          p_link: string
          p_roles: string[]
          p_section: string
          p_target: string
          p_title: string
        }
        Returns: number
      }
      set_my_halaqa_time: {
        Args: { p_halaqa: string; p_time: string }
        Returns: undefined
      }
      set_quality_admin_notes: {
        Args: { p_id: string; p_notes: string }
        Returns: undefined
      }
      set_transport_paid: {
        Args: { p_ids: string[]; p_paid: boolean }
        Returns: number
      }
      start_reading_test: { Args: never; Returns: Json }
      submit_reading_test: {
        Args: { p_answers: Json; p_attempt: string }
        Returns: Json
      }
      unlock_quality_month: { Args: { p_id: string }; Returns: undefined }
      unlock_visit_result: { Args: { p_visit: string }; Returns: undefined }
      update_my_contact: {
        Args: {
          p_guardian_email: string
          p_nearest_mosque: string
          p_phone: string
          p_residence: string
        }
        Returns: undefined
      }
      visible_halaqa_ids: { Args: never; Returns: string[] }
    }
    Enums: {
      account_type: "jawwalpay" | "palpay" | "bank_palestine"
      alert_severity: "note" | "first_warning" | "final_warning"
      alert_status: "new" | "acknowledged"
      exam_list_status: "sent" | "in_progress" | "completed"
      gender_type: "male" | "female"
      halaqa_classification: "a" | "b"
      halaqa_status: "active" | "stopped"
      minutes_status: "draft" | "final"
      profile_status: "pending" | "active" | "disabled"
      report_status: "draft" | "submitted" | "approved"
      statement_status: "draft" | "submitted" | "reviewed"
      student_status: "active" | "withdrawn" | "graduated" | "transferred"
      transaction_type: "income" | "expense"
      user_role:
        | "project_supervisor"
        | "admin_manager"
        | "technical_manager"
        | "women_admin"
        | "field_supervisor"
        | "examiner"
        | "teacher"
        | "student"
      visit_status: "scheduled" | "done" | "late" | "missed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_type: ["jawwalpay", "palpay", "bank_palestine"],
      alert_severity: ["note", "first_warning", "final_warning"],
      alert_status: ["new", "acknowledged"],
      exam_list_status: ["sent", "in_progress", "completed"],
      gender_type: ["male", "female"],
      halaqa_classification: ["a", "b"],
      halaqa_status: ["active", "stopped"],
      minutes_status: ["draft", "final"],
      profile_status: ["pending", "active", "disabled"],
      report_status: ["draft", "submitted", "approved"],
      statement_status: ["draft", "submitted", "reviewed"],
      student_status: ["active", "withdrawn", "graduated", "transferred"],
      transaction_type: ["income", "expense"],
      user_role: [
        "project_supervisor",
        "admin_manager",
        "technical_manager",
        "women_admin",
        "field_supervisor",
        "examiner",
        "teacher",
        "student",
      ],
      visit_status: ["scheduled", "done", "late", "missed"],
    },
  },
} as const
