import 'package:flutter/material.dart';
import 'package:unicons/unicons.dart';

const Map<String, IconData> assetTypeIcons = {
  'Laptop': UniconsLine.laptop,
  'Monitor': UniconsLine.monitor,
  'Phone': UniconsLine.mobile_android,
  'Printer': UniconsLine.print,
  'Mouse': UniconsLine.mouse_alt,
  'Keyboard': UniconsLine.keyboard,
  'Desktop': UniconsLine.desktop,
  'Other': Icons.devices_other,
};

IconData getAssetIcon(String? assetType) {
  if (assetType == null || assetType.isEmpty) {
    return Icons.devices_other;
  }
  
  final normalizedType = assetType.trim();
  
  return assetTypeIcons[normalizedType] ?? 
         assetTypeIcons['Other']!;
}

Widget getAssetIconWidget(
  String? assetType, {
  double size = 24,
  Color? color,
}) {
  return Icon(
    getAssetIcon(assetType),
    size: size,
    color: color ?? Colors.blue.shade700,
  );
}