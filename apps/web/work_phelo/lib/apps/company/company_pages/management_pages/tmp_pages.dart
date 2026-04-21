import 'package:flutter/material.dart';
import 'package:unicons/unicons.dart';

class Departments extends StatelessWidget {
  final VoidCallback onBack;
  const Departments({super.key, required this.onBack});

  @override
  Widget build(BuildContext context) {
    return const Placeholder();
  }
}

class Employees extends StatelessWidget {
  final VoidCallback onBack;
  const Employees({super.key,required this.onBack});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        ListTile(
          trailing: IconButton(
            onPressed: onBack,
            icon: Icon(UniconsLine.building),
          ),
        ),
      ],
    );
  }
}

class AuditLog extends StatelessWidget {
  const AuditLog({super.key});

  @override
  Widget build(BuildContext context) {
    return const Placeholder();
  }
}

class GeneralSettings extends StatelessWidget {
  const GeneralSettings({super.key});

  @override
  Widget build(BuildContext context) {
    return const Placeholder();
  }
}

class AdminAcc extends StatefulWidget {
  const AdminAcc({super.key});

  @override
  State<AdminAcc> createState() => _AdminAccState();
}

class _AdminAccState extends State<AdminAcc> {
  @override
  Widget build(BuildContext context) {
    return const Placeholder();
  }
}
