-- Fix for get_communication_targets type mismatch and support for combined filters
DROP FUNCTION IF EXISTS get_communication_targets(uuid, text, uuid[]);

CREATE OR REPLACE FUNCTION get_communication_targets(
  p_organization_id uuid,
  p_select_all boolean DEFAULT false,
  p_group_ids uuid[] DEFAULT '{}',
  p_tag_item_ids uuid[] DEFAULT '{}',
  p_individual_ids uuid[] DEFAULT '{}'
)
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  phone text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_select_all THEN
    RETURN QUERY
    SELECT m.id, m.full_name::text as name, m.email::text, m.phone::text
    FROM members_summary m
    WHERE m.organization_id = p_organization_id AND m.is_active = true;
  ELSE
    RETURN QUERY
    SELECT DISTINCT m.id, m.full_name::text as name, m.email::text, m.phone::text
    FROM members_summary m
    LEFT JOIN member_tag_items mti ON m.id = mti.member_id
    LEFT JOIN member_assigned_groups mag ON m.id = mag.member_id
    WHERE m.organization_id = p_organization_id 
      AND m.is_active = true
      AND (
        (array_length(p_individual_ids, 1) > 0 AND m.id = ANY(p_individual_ids))
        OR
        (array_length(p_tag_item_ids, 1) > 0 AND mti.tag_item_id = ANY(p_tag_item_ids))
        OR
        (array_length(p_group_ids, 1) > 0 AND mag.group_id = ANY(p_group_ids))
      );
  END IF;
END;
$$;

-- New function for membership counts
CREATE OR REPLACE FUNCTION get_membership_counts(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_active int;
  v_total_in_any_group int;
  v_total_in_any_tag int;
  v_group_counts jsonb;
  v_tag_category_counts jsonb;
  v_tag_item_counts jsonb;
BEGIN
  -- Total active members
  SELECT count(*) INTO v_total_active
  FROM members_summary
  WHERE organization_id = p_organization_id AND is_active = true;

  -- Total unique active members in ANY group
  SELECT count(DISTINCT m.id) INTO v_total_in_any_group
  FROM member_assigned_groups mag
  JOIN members_summary m ON m.id = mag.member_id
  WHERE m.organization_id = p_organization_id AND m.is_active = true;

  -- Total unique active members with ANY tag
  SELECT count(DISTINCT m.id) INTO v_total_in_any_tag
  FROM member_tag_items mti
  JOIN members_summary m ON m.id = mti.member_id
  WHERE m.organization_id = p_organization_id AND m.is_active = true;

  -- Group counts (only active members)
  SELECT COALESCE(jsonb_object_agg(group_id, member_count), '{}'::jsonb) INTO v_group_counts
  FROM (
    SELECT mag.group_id, count(DISTINCT m.id) as member_count
    FROM member_assigned_groups mag
    JOIN members_summary m ON m.id = mag.member_id
    WHERE m.organization_id = p_organization_id AND m.is_active = true
    GROUP BY mag.group_id
  ) gc;

  -- Tag item counts (only active members)
  SELECT COALESCE(jsonb_object_agg(tag_item_id, member_count), '{}'::jsonb) INTO v_tag_item_counts
  FROM (
    SELECT mti.tag_item_id, count(DISTINCT m.id) as member_count
    FROM member_tag_items mti
    JOIN members_summary m ON m.id = mti.member_id
    WHERE m.organization_id = p_organization_id AND m.is_active = true
    GROUP BY mti.tag_item_id
  ) tic;

  -- Tag category counts (only active members, unique per category)
  SELECT COALESCE(jsonb_object_agg(tag_id, member_count), '{}'::jsonb) INTO v_tag_category_counts
  FROM (
    SELECT ti.tag_id, count(DISTINCT m.id) as member_count
    FROM member_tag_items mti
    JOIN tag_items ti ON ti.id = mti.tag_item_id
    JOIN members_summary m ON m.id = mti.member_id
    WHERE m.organization_id = p_organization_id AND m.is_active = true
    GROUP BY ti.tag_id
  ) tcc;

  RETURN jsonb_build_object(
    'total_active', v_total_active,
    'total_in_any_group', v_total_in_any_group,
    'total_in_any_tag', v_total_in_any_tag,
    'groups', v_group_counts,
    'tag_categories', v_tag_category_counts,
    'tag_items', v_tag_item_counts
  );
END;
$$;