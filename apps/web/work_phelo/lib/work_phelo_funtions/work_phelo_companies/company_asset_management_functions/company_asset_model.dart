class AssetModel {
  final String id;
  final String tenantId;
  final String assetName;
  final String assetType;
  final String serialNumber;
  final DateTime purchaseDate;
  final String assetCondition;
  final String availability;
  final DateTime createdAt;
  final DateTime updatedAt;

  AssetModel({
    required this.id,
    required this.tenantId,
    required this.assetName,
    required this.assetType,
    required this.serialNumber,
    required this.purchaseDate,
    required this.assetCondition,
    required this.availability,
    required this.createdAt,
    required this.updatedAt,
  });

  factory AssetModel.create({
    required String tenantId,
    required String assetName,
    required String assetType,
    required String serialNumber,
    required DateTime purchaseDate,
    required String assetCondition,
    required String availability,
  }) {
    final now = DateTime.now();
    return AssetModel(
      id: generateAssetId(assetType: assetType, count: 0),
      tenantId: tenantId,
      assetName: assetName,
      assetType: assetType,
      serialNumber: serialNumber,
      purchaseDate: purchaseDate,
      assetCondition: assetCondition,
      availability: availability,
      createdAt: now,
      updatedAt: now,
    );
  }

  AssetModel copyWith({
    String? id,
    String? tenantId,
    String? assetName,
    String? assetType,
    String? serialNumber,
    DateTime? purchaseDate,
    String? assetCondition,
    String? availability,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return AssetModel(
      id: id ?? this.id,
      tenantId: tenantId ?? this.tenantId,
      assetName: assetName ?? this.assetName,
      assetType: assetType ?? this.assetType,
      serialNumber: serialNumber ?? this.serialNumber,
      purchaseDate: purchaseDate ?? this.purchaseDate,
      assetCondition: assetCondition ?? this.assetCondition,
      availability: availability ?? this.availability,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  String toString() =>
      'Asset(id: $id, name: $assetName, type: $assetType, serial: $serialNumber)';
}

String generateAssetId({required String assetType, required int count}) {
  final typeCode = assetCodes[assetType] ?? 'OTH';
  final year = DateTime.now().year.toString().substring(2);
  final number = (count + 1).toString().padLeft(4, '0');

  return '$typeCode$year$number';
}

const Map<String, String> assetCodes = {
  'Laptop': 'LPT',
  'Monitor': 'MON',
  'Phone': 'PHN',
  'Printer': 'PRN',
  'Mouse': 'MS',
  'Keyboard': 'KBD',
  'Desktop': 'DTP',
  'Other': 'OTH',
};
