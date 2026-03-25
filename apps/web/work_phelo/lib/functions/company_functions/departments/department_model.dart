import 'package:flutter/material.dart';
import 'package:unicons/unicons.dart';

class DepartmentModel {
  final String id;
  final String name;
  final String tenantSlug;
  final Color color;
  final IconData icon;
  final String? headEmail;
  final List<String> memberEmails;
 
  const DepartmentModel({
    required this.id,
    required this.name,
    required this.tenantSlug,
    required this.color,
    required this.icon,
    this.headEmail,
    this.memberEmails = const [],
  });
 
  // ── Computed ────────────────────────────────────────────────
  int get memberCount => memberEmails.length;
  bool get hasHead => headEmail != null && headEmail!.isNotEmpty;
 
  // ── copyWith ────────────────────────────────────────────────
  DepartmentModel copyWith({
    String? name,
    String? tenantSlug,
    Color? color,
    IconData? icon,
    String? headEmail,
    List<String>? memberEmails,
  }) {
    return DepartmentModel(
      id: id,
      name: name ?? this.name,
      tenantSlug: tenantSlug ?? this.tenantSlug,
      color: color ?? this.color,
      icon: icon ?? this.icon,
      headEmail: headEmail ?? this.headEmail,
      memberEmails: memberEmails ?? this.memberEmails,
    );
  }
 
  // ── Helpers ─────────────────────────────────────────────────
  DepartmentModel addMember(String email) {
    if (memberEmails.contains(email)) return this;
    return copyWith(memberEmails: [...memberEmails, email]);
  }
 
  DepartmentModel removeMember(String email) {
    return copyWith(
      memberEmails: memberEmails.where((e) => e != email).toList(),
      // clear head if that person is removed
      headEmail: headEmail == email ? null : headEmail,
    );
  }
 
  DepartmentModel setHead(String email) {
    // head must be a member — add them if not already
    final updatedMembers = memberEmails.contains(email)
        ? memberEmails
        : [...memberEmails, email];
    return copyWith(headEmail: email, memberEmails: updatedMembers);
  }
 
  DepartmentModel clearHead() => copyWith(headEmail: null);
}

String generateDepartmentId(String name) {
  final slug = name
      .trim()
      .toLowerCase()
      .replaceAll(RegExp(r'\s+'), '_')
      .replaceAll(RegExp(r'[^a-z0-9_]'), '');
  final timestamp = DateTime.now().millisecondsSinceEpoch;
  return 'dept_${slug}_$timestamp';
}

final departmentColors = [
  Colors.blue,
  Colors.teal,
  Colors.green,
  Colors.purple,
  Colors.orange,
  Colors.pink,
  Colors.red,
  Colors.indigo,
];
 
final departmentIcons = [
  UniconsLine.users_alt,
  UniconsLine.briefcase,
  UniconsLine.chart_bar,
  UniconsLine.laptop,
  UniconsLine.shield_check,
  UniconsLine.dollar_sign,
  UniconsLine.megaphone,
  UniconsLine.cog,
];