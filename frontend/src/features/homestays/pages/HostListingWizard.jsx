import React, { useState, useRef, useEffect, useMemo } from 'react';
import { hostRegistrationApi } from '../api/hostRegistrationApi.js';
import { homestayApi } from '../api/homestayApi.js';
import { toast } from '../../../shared/feedback/feedback.js';
import './HostListingWizard.css';

const steps = [
  { id: 1, label: 'Vị trí' },
  { id: 2, label: 'Tiện nghi' },
  { id: 3, label: 'Phòng' },
  { id: 4, label: 'Ảnh' },
  { id: 5, label: 'Mô tả' },
  { id: 6, label: 'Chính sách' },
  { id: 7, label: 'Chủ nhà' },
  { id: 8, label: 'Hoàn tất' },
];

const LOCATION_SUGGESTIONS = [
  // Lâm Đồng
  { title: 'Đà Lạt', subtitle: 'Lâm Đồng, Việt Nam', district: 'Đà Lạt', province: 'Lâm Đồng', ward: 'Phường 1' },
  { title: 'Phường 1, Đà Lạt', subtitle: 'Lâm Đồng, Việt Nam', district: 'Đà Lạt', province: 'Lâm Đồng', ward: 'Phường 1' },
  { title: 'Phường 2, Đà Lạt', subtitle: 'Lâm Đồng, Việt Nam', district: 'Đà Lạt', province: 'Lâm Đồng', ward: 'Phường 2' },
  { title: 'Bảo Lộc', subtitle: 'Lâm Đồng, Việt Nam', district: 'Bảo Lộc', province: 'Lâm Đồng', ward: 'Phường 1' },

  // Đà Nẵng
  { title: 'Đà Nẵng', subtitle: 'Thành phố Đà Nẵng, Việt Nam', district: 'Hải Châu', province: 'Đà Nẵng', ward: 'Hải Châu 1' },
  { title: 'Sơn Trà, Đà Nẵng', subtitle: 'Đà Nẵng, Việt Nam', district: 'Sơn Trà', province: 'Đà Nẵng', ward: 'Phước Mỹ' },
  { title: 'Ngũ Hành Sơn, Đà Nẵng', subtitle: 'Đà Nẵng, Việt Nam', district: 'Ngũ Hành Sơn', province: 'Đà Nẵng', ward: 'Mỹ An' },
  { title: 'Hải Châu, Đà Nẵng', subtitle: 'Đà Nẵng, Việt Nam', district: 'Hải Châu', province: 'Đà Nẵng', ward: 'Hải Châu 1' },

  // Khánh Hòa
  { title: 'Nha Trang', subtitle: 'Khánh Hòa, Việt Nam', district: 'Nha Trang', province: 'Khánh Hòa', ward: 'Lộc Thọ' },
  { title: 'Vĩnh Nguyên, Nha Trang', subtitle: 'Khánh Hòa, Việt Nam', district: 'Nha Trang', province: 'Khánh Hòa', ward: 'Vĩnh Nguyên' },
  { title: 'Cam Ranh', subtitle: 'Khánh Hòa, Việt Nam', district: 'Cam Ranh', province: 'Khánh Hòa', ward: 'Cam Phú' },

  // Kiên Giang
  { title: 'Phú Quốc', subtitle: 'Kiên Giang, Việt Nam', district: 'Phú Quốc', province: 'Kiên Giang', ward: 'Dương Đông' },
  { title: 'Dương Đông, Phú Quốc', subtitle: 'Kiên Giang, Việt Nam', district: 'Phú Quốc', province: 'Kiên Giang', ward: 'Dương Đông' },
  { title: 'An Thới, Phú Quốc', subtitle: 'Kiên Giang, Việt Nam', district: 'Phú Quốc', province: 'Kiên Giang', ward: 'An Thới' },

  // Bà Rịa - Vũng Tàu
  { title: 'Vũng Tàu', subtitle: 'Bà Rịa - Vũng Tàu, Việt Nam', district: 'Vũng Tàu', province: 'Bà Rịa - Vũng Tàu', ward: 'Phường 1' },
  { title: 'Bãi Sau, Vũng Tàu', subtitle: 'Bà Rịa - Vũng Tàu, Việt Nam', district: 'Vũng Tàu', province: 'Bà Rịa - Vũng Tàu', ward: 'Phường 2' },
  { title: 'Bãi Trước, Vũng Tàu', subtitle: 'Bà Rịa - Vũng Tàu, Việt Nam', district: 'Vũng Tàu', province: 'Bà Rịa - Vũng Tàu', ward: 'Phường 1' },
  { title: 'Côn Đảo', subtitle: 'Bà Rịa - Vũng Tàu, Việt Nam', district: 'Côn Đảo', province: 'Bà Rịa - Vũng Tàu', ward: '' },

  // TP. Hồ Chí Minh
  { title: 'Quận 1, TP. Hồ Chí Minh', subtitle: 'TP. Hồ Chí Minh, Việt Nam', district: 'Quận 1', province: 'TP. Hồ Chí Minh', ward: 'Bến Nghé' },
  { title: 'Quận 3, TP. Hồ Chí Minh', subtitle: 'TP. Hồ Chí Minh, Việt Nam', district: 'Quận 3', province: 'TP. Hồ Chí Minh', ward: 'Võ Thị Sáu' },
  { title: 'Thảo Điền, TP. Thủ Đức', subtitle: 'TP. Hồ Chí Minh, Việt Nam', district: 'TP. Thủ Đức', province: 'TP. Hồ Chí Minh', ward: 'Thảo Điền' },
  { title: 'Bình Thạnh, TP. Hồ Chí Minh', subtitle: 'TP. Hồ Chí Minh, Việt Nam', district: 'Bình Thạnh', province: 'TP. Hồ Chí Minh', ward: 'Phường 25' },
  { title: 'Quận 7, TP. Hồ Chí Minh', subtitle: 'TP. Hồ Chí Minh, Việt Nam', district: 'Quận 7', province: 'TP. Hồ Chí Minh', ward: 'Tân Phong' },

  // Hà Nội
  { title: 'Hoàn Kiếm, Hà Nội', subtitle: 'Hà Nội, Việt Nam', district: 'Hoàn Kiếm', province: 'Hà Nội', ward: 'Hàng Trống' },
  { title: 'Tây Hồ, Hà Nội', subtitle: 'Hà Nội, Việt Nam', district: 'Tây Hồ', province: 'Hà Nội', ward: 'Quảng An' },
  { title: 'Ba Đình, Hà Nội', subtitle: 'Hà Nội, Việt Nam', district: 'Ba Đình', province: 'Hà Nội', ward: 'Điện Biên' },
  { title: 'Cầu Giấy, Hà Nội', subtitle: 'Hà Nội, Việt Nam', district: 'Cầu Giấy', province: 'Hà Nội', ward: 'Dịch Vọng' },

  // Quảng Nam
  { title: 'Hội An', subtitle: 'Quảng Nam, Việt Nam', district: 'Hội An', province: 'Quảng Nam', ward: 'Minh An' },

  // Lào Cai
  { title: 'Sa Pa', subtitle: 'Lào Cai, Việt Nam', district: 'Sa Pa', province: 'Lào Cai', ward: 'Sa Pa' },

  // Quảng Ninh
  { title: 'Hạ Long', subtitle: 'Quảng Ninh, Việt Nam', district: 'Hạ Long', province: 'Quảng Ninh', ward: 'Bãi Cháy' },
  { title: 'Bãi Cháy, Hạ Long', subtitle: 'Quảng Ninh, Việt Nam', district: 'Hạ Long', province: 'Quảng Ninh', ward: 'Bãi Cháy' },

  // Bình Định
  { title: 'Quy Nhơn', subtitle: 'Bình Định, Việt Nam', district: 'Quy Nhơn', province: 'Bình Định', ward: 'Ghềnh Ráng' },

  // Bình Thuận
  { title: 'Phan Thiết', subtitle: 'Bình Thuận, Việt Nam', district: 'Phan Thiết', province: 'Bình Thuận', ward: 'Mũi Né' },
  { title: 'Mũi Né, Phan Thiết', subtitle: 'Bình Thuận, Việt Nam', district: 'Phan Thiết', province: 'Bình Thuận', ward: 'Mũi Né' },

  // Thừa Thiên Huế
  { title: 'Huế', subtitle: 'Thừa Thiên Huế, Việt Nam', district: 'TP. Huế', province: 'Thừa Thiên Huế', ward: 'Phú Nhuận' },

  // Cần Thơ
  { title: 'Ninh Kiều, Cần Thơ', subtitle: 'Cần Thơ, Việt Nam', district: 'Ninh Kiều', province: 'Cần Thơ', ward: 'Tân An' },

  // Ninh Bình
  { title: 'Hoa Lư, Ninh Bình', subtitle: 'Ninh Bình, Việt Nam', district: 'Hoa Lư', province: 'Ninh Bình', ward: 'Ninh Hải' },
  { title: 'Tràng An / Tam Cốc', subtitle: 'Ninh Bình, Việt Nam', district: 'Hoa Lư', province: 'Ninh Bình', ward: 'Ninh Hải' },

  // Phú Yên
  { title: 'Tuy Hòa', subtitle: 'Phú Yên, Việt Nam', district: 'Tuy Hòa', province: 'Phú Yên', ward: 'Phường 7' },

  // Đắk Lắk
  { title: 'Buôn Ma Thuột', subtitle: 'Đắk Lắk, Việt Nam', district: 'Buôn Ma Thuột', province: 'Đắk Lắk', ward: 'Tân Lập' },

  // Sơn La
  { title: 'Mộc Châu', subtitle: 'Sơn La, Việt Nam', district: 'Mộc Châu', province: 'Sơn La', ward: 'Mộc Châu' },

  // Hà Giang
  { title: 'Đồng Văn, Hà Giang', subtitle: 'Hà Giang, Việt Nam', district: 'Đồng Văn', province: 'Hà Giang', ward: 'Đồng Văn' },

  // Vĩnh Phúc
  { title: 'Tam Đảo', subtitle: 'Vĩnh Phúc, Việt Nam', district: 'Tam Đảo', province: 'Vĩnh Phúc', ward: 'Tam Đảo' },

  // Hải Phòng
  { title: 'Cát Bà, Hải Phòng', subtitle: 'Hải Phòng, Việt Nam', district: 'Cát Hải', province: 'Hải Phòng', ward: 'Cát Bà' },
];

function normalizeSearchText(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

const DATABASE_ROOM_TYPES = [
  {
    name: 'Phòng đơn',
    description: 'Phòng riêng gọn gàng dành cho một khách.',
    basePrice: '450000',
    maxAdults: 1,
    maxChildren: 0,
    bedType: 'Single',
    roomSize: '18',
    badge: '1 khách • 18 m²',
  },
  {
    name: 'Phòng đôi',
    description: 'Phòng đôi tiện nghi dành cho hai khách.',
    basePrice: '700000',
    maxAdults: 2,
    maxChildren: 1,
    bedType: 'Queen',
    roomSize: '26',
    badge: '2 khách • 26 m²',
  },
  {
    name: 'Phòng có ban công',
    description: 'Phòng rộng có ban công riêng và tầm nhìn thoáng.',
    basePrice: '950000',
    maxAdults: 3,
    maxChildren: 1,
    bedType: 'King + Single',
    roomSize: '32',
    badge: '3 khách • 32 m²',
  },
  {
    name: 'Phòng gia đình',
    description: 'Phòng rộng dành cho gia đình hoặc nhóm bạn.',
    basePrice: '1350000',
    maxAdults: 4,
    maxChildren: 2,
    bedType: '2 Queen',
    roomSize: '45',
    badge: '4 khách • 45 m²',
  },
];

const popularAmenities = [
  { id: 1, name: 'Nhà bếp', icon: '🍳', category: 'Tiện ích' },
  { id: 2, name: 'Nhìn ra thành phố', icon: '🏙️', category: 'Phòng' },
  { id: 3, name: 'Sân vườn', icon: '🌳', category: 'Tiện ích' },
  { id: 4, name: 'Cho phép mang theo vật nuôi', icon: '🐾', category: 'Dịch vụ' },
  { id: 5, name: 'WiFi miễn phí', icon: '📶', category: 'Internet' },
  { id: 6, name: 'Ban công', icon: '🌅', category: 'Phòng' },
  { id: 7, name: 'Chỗ đỗ xe miễn phí', icon: '🚗', category: 'Dịch vụ' },
  { id: 8, name: 'Máy điều hòa', icon: '❄️', category: 'Phòng' },
  { id: 9, name: 'TV màn hình phẳng', icon: '📺', category: 'Phòng' },
  { id: 10, name: 'Phòng tắm riêng', icon: '🚿', category: 'Phòng' },
  { id: 11, name: 'Máy sấy tóc', icon: '💨', category: 'Phòng' },
  { id: 12, name: 'Ấm đun nước', icon: '🫖', category: 'Phòng' },
  { id: 13, name: 'Tủ lạnh mini', icon: '🧊', category: 'Phòng' },
  { id: 14, name: 'Dọn phòng hằng ngày', icon: '🧹', category: 'Dịch vụ' },
  { id: 15, name: 'Lễ tân 24 giờ', icon: '🛎️', category: 'Dịch vụ' },
  { id: 16, name: 'Hồ bơi', icon: '🏊', category: 'Giải trí' },
  { id: 17, name: 'Khu vui chơi trẻ em', icon: '🎠', category: 'Giải trí' },
  { id: 18, name: 'Máy giặt', icon: '🧺', category: 'Tiện ích' },
  { id: 19, name: 'Bàn làm việc', icon: '💻', category: 'Phòng' },
  { id: 20, name: 'Dịch vụ đưa đón', icon: '🚐', category: 'Dịch vụ' },
];

const popularBanks = [
  'Vietcombank (VCB)',
  'MB Bank (Quân Đội)',
  'Techcombank (TCB)',
  'BIDV',
  'VietinBank',
  'ACB',
  'VPBank',
  'TPBank',
  'Sacombank',
];

const SAMPLE_HOMESTAY_PHOTOS = [
  { label: 'Phòng khách sang trọng', url: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Phòng ngủ ấm cúng', url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Ban công ngắm cảnh', url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Phòng tắm hiện đại', url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Khuôn viên ngoài trời', url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80' },
];

const logoWhite = '/assets/figma/tripio-logo-white.png';

export default function HostListingWizard({ user, onBack, onSuccess }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapCoords, setMapCoords] = useState(null);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [menuOpenIndex, setMenuOpenIndex] = useState(null);
  const searchContainerRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowLocationDropdown(false);
      }
      if (!e.target.closest('.simple-photo-card')) {
        setMenuOpenIndex(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Form Data
  const [formData, setFormData] = useState({
    // Step 1: Vị trí
    searchLocation: '',
    province: 'Lâm Đồng',
    district: 'Đà Lạt',
    ward: 'Phường 1',
    addressLine: '',

    // Step 2: Tiện nghi (theo database seed)
    selectedAmenities: [1, 5, 7, 8],

    // Step 3: Phòng & Giá (để trống để người dùng tự nhập)
    roomTypeName: '',
    roomDescription: '',
    roomBedType: '',
    roomSize: '',
    roomBasePrice: '',
    roomMaxAdults: '',
    roomMaxChildren: '',

    // Step 4: Ảnh (để trống để người dùng tự tải ảnh của mình)
    images: [],
    newImageUrl: '',
    imageUrl: '',

    // Step 5: Tên & Mô tả
    homestayName: '',
    description: '',

    // Step 6: Chính sách & Nội quy lưu trú (chuẩn hệ thống Host)
    checkInTime: '14:00',
    checkOutTime: '12:00',
    standardDepositPercent: '30',
    holidayDepositPercent: '50',
    allowPets: true,
    petFeePerNight: '150000',
    maxPetsPerRoom: '1',
    smokingAllowed: false,
    quietHoursFrom: '22:00',
    quietHoursTo: '07:00',
    partiesRequireApproval: true,

    // Step 7: Chủ nhà & Ngân hàng
    phoneNumber: user?.phoneNumber || '',
    idCardNumber: '',
    bankName: 'Vietcombank (VCB)',
    bankAccountNumber: '',
    bankAccountName: (user?.fullName || '').toUpperCase(),
  });

  const filteredSuggestions = useMemo(() => {
    const rawQuery = (formData?.searchLocation || '').trim();
    if (!rawQuery) {
      return LOCATION_SUGGESTIONS.slice(0, 8);
    }
    const q = normalizeSearchText(rawQuery);
    return LOCATION_SUGGESTIONS.filter((item) => {
      const matchTitle = normalizeSearchText(item.title).includes(q);
      const matchSubtitle = normalizeSearchText(item.subtitle).includes(q);
      const matchDistrict = normalizeSearchText(item.district).includes(q);
      const matchProvince = normalizeSearchText(item.province).includes(q);
      return matchTitle || matchSubtitle || matchDistrict || matchProvince;
    }).slice(0, 10);
  }, [formData?.searchLocation]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const toggleAmenity = (id) => {
    setFormData((prev) => {
      const exists = prev.selectedAmenities.includes(id);
      return {
        ...prev,
        selectedAmenities: exists
          ? prev.selectedAmenities.filter((x) => x !== id)
          : [...prev.selectedAmenities, id],
      };
    });
  };

  const handleSelectSuggestion = (item) => {
    setMapCoords(null);
    setFormData((prev) => ({
      ...prev,
      province: item.province,
      district: item.district,
      ward: item.ward || prev.ward,
      searchLocation: `${item.title}, ${item.subtitle}`,
    }));
    setShowLocationDropdown(false);
  };

  const handleApplyCustomSearch = () => {
    const val = (formData.searchLocation || '').trim();
    if (!val) return;
    setMapCoords(null);
    setFormData((prev) => ({
      ...prev,
      addressLine: prev.addressLine || val,
    }));
    setShowLocationDropdown(false);
  };

  const handleAddImageUrl = () => {
    const url = (formData.newImageUrl || '').trim();
    if (!url) {
      toast.error('Vui lòng nhập đường dẫn ảnh hợp lệ.');
      return;
    }
    setFormData((prev) => {
      const updated = [...(prev.images || []), url];
      return {
        ...prev,
        images: updated,
        newImageUrl: '',
        imageUrl: prev.imageUrl || url,
      };
    });
    toast.success('Đã thêm 1 ảnh vào danh sách!');
  };

  const handleRemoveImage = (index) => {
    setFormData((prev) => {
      const updated = (prev.images || []).filter((_, i) => i !== index);
      return {
        ...prev,
        images: updated,
        imageUrl: updated[0] || '',
      };
    });
  };

  const handleSetCoverImage = (index) => {
    setFormData((prev) => {
      const list = [...(prev.images || [])];
      if (index > 0 && index < list.length) {
        const [selected] = list.splice(index, 1);
        list.unshift(selected);
      }
      return {
        ...prev,
        images: list,
        imageUrl: list[0] || '',
      };
    });
    toast.success('Đã đặt làm ảnh bìa chính!');
  };

  // Upload to storage right away and keep only the returned URL: a base64 data URL would not fit
  // the image_url column and the image would be silently lost when the listing is saved.
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    let uploadedCount = 0;
    for (const file of files) {
      try {
        const { url } = user?.role === 'Host'
          ? await homestayApi.uploadHostImage(file)
          : await hostRegistrationApi.uploadImage(file);
        uploadedCount++;
        setFormData((prev) => ({
          ...prev,
          images: [...(prev.images || []), url],
          imageUrl: prev.imageUrl || url,
        }));
      } catch (error) {
        toast.error(`Không tải được ảnh ${file.name}: ${error.message || 'lỗi không xác định'}`);
      }
    }
    if (uploadedCount) toast.success(`Đã tải lên ${uploadedCount} ảnh!`);
  };

  const handleAddSampleImage = (url, label) => {
    if ((formData.images || []).includes(url)) {
      toast.info(`Ảnh ${label} đã có trong danh sách.`);
      return;
    }
    setFormData((prev) => {
      const updated = [...(prev.images || []), url];
      return {
        ...prev,
        images: updated,
        imageUrl: prev.imageUrl || url,
      };
    });
    toast.success(`Đã thêm ảnh mẫu ${label}!`);
  };

  const handleLocateCurrentPosition = () => {
    if (!navigator.geolocation) {
      toast.error('Trình duyệt của bạn không hỗ trợ định vị GPS.');
      return;
    }
    setLocating(true);
    toast.info('Đang xác định tọa độ GPS của thiết bị...');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setMapCoords({ lat, lng });

        toast.success(`Đã định vị thành công (${lat.toFixed(4)}, ${lng.toFixed(4)})!`);

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=vi`
          );
          const data = await res.json();
          if (data && data.address) {
            const a = data.address;
            const prov = a.city || a.state || a.province || '';
            const dist = a.suburb || a.city_district || a.district || a.county || '';
            const ward = a.quarter || a.neighbourhood || a.suburb || '';
            const road = [a.house_number, a.road].filter(Boolean).join(' ') || data.name || '';

            setFormData((prev) => ({
              ...prev,
              province: prov || prev.province,
              district: dist || prev.district,
              ward: ward || prev.ward,
              addressLine: road || prev.addressLine,
              searchLocation: `${road ? road + ', ' : ''}${dist ? dist + ', ' : ''}${prov}`,
            }));
            toast.success('Đã tự động điền địa chỉ từ vị trí GPS!');
          }
        } catch {
          // Keep GPS coordinates for Google Map iframe
        } finally {
          setLocating(false);
        }
      },
      (error) => {
        setLocating(false);
        let msg = 'Không thể lấy vị trí hiện tại.';
        if (error.code === 1) {
          msg = 'Vui lòng cho phép quyền truy cập vị trí trên trình duyệt để định vị tự động.';
        } else if (error.code === 2) {
          msg = 'Không tìm thấy tín hiệu định vị vị trí.';
        } else if (error.code === 3) {
          msg = 'Hết thời gian chờ định vị vị trí.';
        }
        toast.error(msg);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const computedMapAddress = mapCoords
    ? `${mapCoords.lat},${mapCoords.lng}`
    : [formData.addressLine, formData.ward, formData.district, formData.province]
        .filter(Boolean)
        .join(', ') || 'Đà Lạt, Lâm Đồng';

  const handleNext = () => {
    // Validation per step
    if (currentStep === 1) {
      if (!formData.province.trim() || !formData.addressLine.trim()) {
        toast.error('Vui lòng nhập địa chỉ cụ thể và tỉnh/thành phố của chỗ nghỉ.');
        return;
      }
    } else if (currentStep === 3) {
      if (!formData.roomTypeName.trim() || !formData.roomBasePrice) {
        toast.error('Vui lòng nhập tên loại phòng và giá mỗi đêm.');
        return;
      }
    } else if (currentStep === 4) {
      const validImages = (formData.images || []).filter(Boolean);
      if (validImages.length < 3) {
        toast.error(`Thêm ít nhất 3 ảnh để tiếp tục (hiện có ${validImages.length}/3 ảnh).`);
        return;
      }
    } else if (currentStep === 5) {
      if (!formData.homestayName.trim()) {
        toast.error('Vui lòng đặt tên cho Homestay của bạn.');
        return;
      }
    } else if (currentStep === 7) {
      if (!formData.phoneNumber.trim() || !formData.idCardNumber.trim() || !formData.bankAccountNumber.trim()) {
        toast.error('Vui lòng điền đủ Số điện thoại, CCCD và Tài khoản ngân hàng nhận tiền.');
        return;
      }
    }

    if (currentStep < 8) {
      setCurrentStep((c) => c + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep((c) => c - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      onBack();
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // 1. Submit Host Registration request
      await hostRegistrationApi.register({
        phoneNumber: formData.phoneNumber,
        idCardNumber: formData.idCardNumber,
        bankName: formData.bankName,
        bankAccountNumber: formData.bankAccountNumber,
        bankAccountName: formData.bankAccountName,
        homestayData: {
          homestayName: formData.homestayName,
          description: formData.description,
          addressLine: formData.addressLine,
          ward: formData.ward,
          district: formData.district,
          province: formData.province,
          roomTypeName: formData.roomTypeName,
          roomBasePrice: formData.roomBasePrice,
          images: (formData.images && formData.images.length > 0) ? formData.images : (formData.imageUrl ? [formData.imageUrl] : []),
        },
      }).catch((e) => {
        console.warn('Host registration notice:', e);
      });

      // 2. If user already has host privileges, also create homestay listing
      if (user?.role === 'Host') {
        const created = await homestayApi.createHomestay({
          name: formData.homestayName,
          description: formData.description || `Homestay sang trọng tại ${formData.district}, ${formData.province}`,
          addressLine: formData.addressLine,
          ward: formData.ward,
          district: formData.district,
          province: formData.province,
          checkInTime: formData.checkInTime,
          checkOutTime: formData.checkOutTime,
        });

        if (created?.id) {
          // 2.1 Gán tiện ích đã chọn theo DB
          if (formData.selectedAmenities?.length) {
            await homestayApi.saveAmenities(created.id, formData.selectedAmenities).catch(() => {});
          }

          // 2.2 Thêm tất cả ảnh chỗ nghỉ (ảnh đầu tiên là ảnh bìa chính)
          const imagesToSave = (formData.images && formData.images.length > 0)
            ? formData.images
            : (formData.imageUrl ? [formData.imageUrl] : []);

          let failedImages = 0;
          for (let i = 0; i < imagesToSave.length; i++) {
            await homestayApi.addImage(created.id, {
              imageUrl: imagesToSave[i],
              caption: i === 0 ? 'Ảnh bìa chính homestay' : `Ảnh homestay #${i + 1}`,
              isThumbnail: i === 0,
            }).catch(() => { failedImages++; });
          }
          if (failedImages) toast.error(`${failedImages} ảnh không lưu được. Bạn có thể thêm lại trong trang quản lý homestay.`);

          // 2.3 Thêm loại phòng theo thiết lập CSDL (room_types)
          const rtRes = await homestayApi.addRoomType(created.id, {
            name: formData.roomTypeName,
            description: formData.roomDescription || `${formData.roomTypeName} tiện nghi cho chuyến đi của bạn.`,
            basePrice: Number(formData.roomBasePrice),
            maxAdults: Number(formData.roomMaxAdults),
            maxChildren: Number(formData.roomMaxChildren),
            bedType: formData.roomBedType,
            roomSize: formData.roomSize ? Number(formData.roomSize) : 26,
            baseCapacity: Number(formData.roomMaxAdults),
            maxCapacity: Number(formData.roomMaxAdults) + Number(formData.roomMaxChildren),
            extraGuestAllowed: false,
            extraGuestFee: 0,
            depositPercent: 0.3,
          }).catch(() => null);

          // 2.4 Khởi tạo phòng thực tế trong CSDL (rooms)
          if (rtRes?.id) {
            await homestayApi.addRoom(created.id, rtRes.id, {
              roomNumber: '101',
              floorNumber: 1,
              status: 'Available',
              note: 'Phòng chính',
            }).catch(() => {});
          }

          // 2.5 Lưu cấu hình chính sách & quy định lưu trú theo chuẩn Host
          await homestayApi.saveHostPolicy(created.id, {
            holdMinutes: 15,
            reviewCreateDays: 14,
            reviewEditDays: 14,
            commissionRate: 0.1,
            guestDowngradeRefundMode: 'Percent',
            guestDowngradeRefundPercent: 100,
            autoApproveLateCheckoutWithoutNextBooking: true,
            effectiveFrom: null,
            cancellationTiers: [
              { minimumDays: 7, maximumDays: null, refundPercent: 100 },
              { minimumDays: 3, maximumDays: 7, refundPercent: 50 },
              { minimumDays: 0, maximumDays: 3, refundPercent: 0 },
            ],
            lateCheckoutTiers: [
              { fromMinutes: 1, toMinutes: 180, calculationType: 'NightlyPercent', value: 30 },
              { fromMinutes: 181, toMinutes: 360, calculationType: 'NightlyPercent', value: 50 },
              { fromMinutes: 361, toMinutes: null, calculationType: 'NightlyPercent', value: 100 },
            ],
            document: {
              payment: {
                standardDepositPercent: Number(formData.standardDepositPercent) || 30,
                villaDepositPercent: 50,
                holidayDepositPercent: Number(formData.holidayDepositPercent) || 50,
              },
              pets: {
                allowed: Boolean(formData.allowPets),
                maximumPerRoom: Number(formData.maxPetsPerRoom) || 1,
                feePerNight: Number(formData.petFeePerNight) || 150000,
              },
              houseRules: {
                smokingInRoomAllowed: Boolean(formData.smokingAllowed),
                partiesRequireApproval: Boolean(formData.partiesRequireApproval),
                quietHoursFrom: formData.quietHoursFrom || '22:00',
                quietHoursTo: formData.quietHoursTo || '07:00',
              },
            },
          }).catch(() => {});

          // 2.6 Gửi hồ sơ đăng ký sang trạng thái Chờ duyệt (Pending) để Admin phê duyệt
          await homestayApi.submitHomestay(created.id).catch(() => {});
        }
      }

      toast.success('Gửi hồ sơ đăng ký chỗ nghỉ thành công! Ban quản trị sẽ sớm duyệt hồ sơ của bạn.');
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi gửi hồ sơ đăng ký.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="agoda-wizard-page">
      {/* Top Header Bar */}
      <header className="agoda-wizard-header">
        <div className="header-brand">
          <button type="button" className="logo-btn" onClick={onBack} aria-label="Quay lại trang chủ">
            <img src={logoWhite} alt="tripio" className="wizard-logo-img" />
          </button>
          <span className="brand-sep">|</span>
          <span className="wizard-title">Đăng kí Homestay</span>
        </div>
        <div className="header-actions">
          <button type="button" className="save-exit-btn" onClick={onBack}>
            Lưu và thoát
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="agoda-wizard-container">
        {/* Left Stepper Sidebar */}
        <aside className="agoda-stepper-sidebar">
          <div className="stepper-track">
            {steps.map((st) => {
              const isPassed = currentStep > st.id;
              const isCurrent = currentStep === st.id;
              return (
                <div
                  key={st.id}
                  className={`stepper-node ${isCurrent ? 'active' : ''} ${isPassed ? 'completed' : ''}`}
                  onClick={() => {
                    if (isPassed) setCurrentStep(st.id);
                  }}
                >
                  <div className="node-marker">
                    {isPassed ? '✓' : st.id}
                  </div>
                  <span className="node-label">{st.label}</span>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Right Content Area */}
        <main className="agoda-wizard-content">
          <div className="wizard-step-tag">Bước {currentStep}/8</div>

          {/* STEP 1: VỊ TRÍ */}
          {currentStep === 1 && (
            <section className="step-section">
              <h1 className="step-title">Vị trí</h1>
              <p className="step-desc">
                Hãy cho chúng tôi biết chỗ nghỉ của bạn ở đâu để khách có thể dễ dàng tìm thấy.
              </p>

              <div className="wizard-search-box-wrapper" ref={searchContainerRef}>
                <div className={`wizard-search-box ${showLocationDropdown ? 'is-focused' : ''}`}>
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    placeholder="Tìm kiếm địa chỉ, tỉnh/thành phố, địa danh..."
                    value={formData.searchLocation}
                    onFocus={() => setShowLocationDropdown(true)}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, searchLocation: e.target.value }));
                      setShowLocationDropdown(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (filteredSuggestions.length > 0) {
                          handleSelectSuggestion(filteredSuggestions[0]);
                        } else {
                          handleApplyCustomSearch();
                        }
                      }
                    }}
                  />
                  {formData.searchLocation && (
                    <button
                      type="button"
                      className="search-clear-btn"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, searchLocation: '' }));
                        setShowLocationDropdown(true);
                      }}
                      title="Xóa tìm kiếm"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {showLocationDropdown && (
                  <div className="location-suggestions-dropdown">
                    <div className="dropdown-heading">
                      {formData.searchLocation.trim() ? 'Gợi ý kết quả phù hợp' : 'Điểm đến phổ biến'}
                    </div>
                    <ul className="suggestions-list">
                      {filteredSuggestions.map((item, idx) => (
                        <li
                          key={idx}
                          className="suggestion-item"
                          onClick={() => handleSelectSuggestion(item)}
                        >
                          <span className="item-pin-icon">📍</span>
                          <div className="item-info">
                            <span className="item-title">{item.title}</span>
                            <span className="item-subtitle">{item.subtitle}</span>
                          </div>
                        </li>
                      ))}
                      {filteredSuggestions.length === 0 && (
                        <li className="suggestion-item-empty">
                          <span>Không tìm thấy địa điểm trùng khớp với &ldquo;{formData.searchLocation}&rdquo;.</span>
                        </li>
                      )}
                    </ul>
                    {formData.searchLocation.trim() && (
                      <div
                        className="suggestion-custom-search"
                        onClick={handleApplyCustomSearch}
                      >
                        <span className="custom-search-icon">🔍</span>
                        <span>Tìm &ldquo;{formData.searchLocation}&rdquo; trên bản đồ</span>
                      </div>
                    )}
                  </div>
                )}
              </div>



              <div className="wizard-form-card">
                <div className="field-group">
                  <label>
                    Tỉnh / Thành phố <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    name="province"
                    value={formData.province}
                    onChange={handleChange}
                    placeholder="VD: Lâm Đồng"
                    required
                  />
                </div>

                <div className="field-row">
                  <div className="field-group">
                    <label>
                      Quận / Huyện / Thị xã <span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      name="district"
                      value={formData.district}
                      onChange={handleChange}
                      placeholder="VD: Đà Lạt"
                      required
                    />
                  </div>
                  <div className="field-group">
                    <label>Phường / Xã</label>
                    <input
                      type="text"
                      name="ward"
                      value={formData.ward}
                      onChange={handleChange}
                      placeholder="VD: Phường 1"
                    />
                  </div>
                </div>

                <div className="field-group">
                  <label>
                    Địa chỉ cụ thể (Số nhà, Tên đường) <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    name="addressLine"
                    value={formData.addressLine}
                    onChange={handleChange}
                    placeholder="VD: 12A Lê Đại Hành"
                    required
                  />
                  <small className="hint">
                    Địa chỉ chính xác sẽ chỉ được chia sẻ cho khách sau khi đặt phòng hoàn tất.
                  </small>
                </div>

                {/* Google Maps Clean Display like screenshot */}
                <div className="google-map-card">
                  <div className="map-embed-wrapper">
                    <iframe
                      title="Google Maps"
                      src={`https://maps.google.com/maps?q=${encodeURIComponent(computedMapAddress)}&t=&z=14&ie=UTF8&iwloc=&output=embed`}
                      width="100%"
                      height="320"
                      style={{ border: 0, display: 'block' }}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                </div>
                <p className="map-prompt-text">
                  Đây có phải là vị trí chính xác của chỗ nghỉ không? Nếu không, hãy kéo ghim đến đúng vị trí hoặc điều chỉnh lại địa chỉ phía trên.
                </p>
              </div>
            </section>
          )}

              {/* STEP 2: TIỆN NGHI */}
          {currentStep === 2 && (
            <section className="step-section">
              <h1 className="step-title">Tiện nghi</h1>
              <p className="step-desc">
                Những tiện ích nào chỗ nghỉ của bạn cung cấp cho du khách?
              </p>

              <div className="amenities-info-alert">
                <span className="alert-info-icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="10" fill="#0b4ae6" />
                    <circle cx="10" cy="5.8" r="1.2" fill="#ffffff" />
                    <rect x="8.8" y="8.8" width="2.4" height="6.2" rx="1.2" fill="#ffffff" />
                  </svg>
                </span>
                <span className="alert-info-text">
                  Bạn có thể thêm nhiều tiện ích hơn vào danh sách của mình sau khi nó hoạt động.
                </span>
              </div>

              <div className="amenities-grid">
                {popularAmenities.map((am) => {
                  const checked = formData.selectedAmenities.includes(am.id);
                  return (
                    <div
                      key={am.id}
                      className={`amenity-card ${checked ? 'checked' : ''}`}
                      onClick={() => toggleAmenity(am.id)}
                    >
                      <span className="am-icon">{am.icon}</span>
                      <div className="am-info">
                        <strong>{am.name}</strong>
                        <small>{am.category}</small>
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {}}
                        aria-label={am.name}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* STEP 3: PHÒNG */}
          {currentStep === 3 && (
            <section className="step-section">
              <h1 className="step-title">Phòng & Giá mỗi đêm</h1>
              <p className="step-desc">
                Thiết lập loại phòng chính và giá thuê khởi điểm cho homestay của bạn.
              </p>

              <div className="wizard-form-card">
                <div className="field-group">
                  <label>Tên loại phòng <span className="req">*</span></label>
                  <input
                    type="text"
                    name="roomTypeName"
                    value={formData.roomTypeName}
                    onChange={handleChange}
                    placeholder="VD: Phòng đôi, Phòng gia đình, Phòng VIP..."
                    required
                  />
                </div>

                <div className="field-row">
                  <div className="field-group">
                    <label>Loại giường (Bed Type) <span className="req">*</span></label>
                    <input
                      type="text"
                      name="roomBedType"
                      value={formData.roomBedType}
                      onChange={handleChange}
                      placeholder="VD: 1 Giường đôi Queen, 2 Giường đơn..."
                      required
                    />
                  </div>
                  <div className="field-group">
                    <label>Diện tích phòng (m²)</label>
                    <input
                      type="number"
                      name="roomSize"
                      min="10"
                      max="200"
                      value={formData.roomSize}
                      onChange={handleChange}
                      placeholder="VD: 26"
                    />
                  </div>
                </div>

                <div className="field-row">
                  <div className="field-group">
                    <label>Giá mỗi đêm (VND) <span className="req">*</span></label>
                    <input
                      type="number"
                      name="roomBasePrice"
                      value={formData.roomBasePrice}
                      onChange={handleChange}
                      placeholder="VD: 700000"
                      required
                    />
                  </div>
                  <div className="field-group">
                    <label>Mô tả ngắn loại phòng</label>
                    <input
                      type="text"
                      name="roomDescription"
                      value={formData.roomDescription}
                      onChange={handleChange}
                      placeholder="VD: Phòng đôi tiện nghi, có ban công thoáng mát..."
                    />
                  </div>
                </div>

                <div className="field-row">
                  <div className="field-group">
                    <label>Số người lớn tối đa</label>
                    <input
                      type="number"
                      name="roomMaxAdults"
                      min="1"
                      max="20"
                      value={formData.roomMaxAdults}
                      onChange={handleChange}
                      placeholder="VD: 2"
                    />
                  </div>
                  <div className="field-group">
                    <label>Số trẻ em tối đa</label>
                    <input
                      type="number"
                      name="roomMaxChildren"
                      min="0"
                      max="10"
                      value={formData.roomMaxChildren}
                      onChange={handleChange}
                      placeholder="VD: 1"
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* STEP 4: ẢNH */}
          {currentStep === 4 && (
            <section className="step-section">
              <h1 className="step-main-title">Ảnh</h1>
              <h2 className="step-sub-title">Ảnh Homestay</h2>
              <p className="step-desc">
                Hãy giới thiệu Homestay của bạn với những bức ảnh chất lượng cao để thu hút các đặt phòng.
              </p>

              {/* Thông báo xanh: Thêm ít nhất 3 ảnh để tiếp tục */}
              <div className="simple-info-banner">
                <span className="info-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                  </svg>
                </span>
                <span className="info-text">Thêm ít nhất 3 ảnh để tiếp tục</span>
              </div>

              {/* Input file ẩn hỗ trợ chọn nhiều ảnh */}
              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />

              {/* Lưới ảnh đơn giản theo đúng mẫu screenshot */}
              <div className="simple-photo-gallery">
                {(formData.images || []).map((imgUrl, idx) => {
                  const isCover = idx === 0;
                  return (
                    <div key={idx} className="simple-photo-card">
                      <img src={imgUrl} alt={`Ảnh Homestay ${idx + 1}`} />

                      {isCover ? (
                        <span className="simple-cover-badge">Ảnh chính</span>
                      ) : (
                        <button
                          type="button"
                          className="simple-choose-main-btn"
                          onClick={() => handleSetCoverImage(idx)}
                          title="Chọn ảnh này làm ảnh chính"
                        >
                          Đặt làm ảnh chính
                        </button>
                      )}

                      <button
                        type="button"
                        className="simple-more-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenIndex(menuOpenIndex === idx ? null : idx);
                        }}
                        aria-label="Tùy chọn ảnh"
                      >
                        ⋮
                      </button>

                      {menuOpenIndex === idx && (
                        <div
                          className="simple-photo-dropdown"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {!isCover && (
                            <button
                              type="button"
                              className="dropdown-action-btn"
                              onClick={() => {
                                handleSetCoverImage(idx);
                                setMenuOpenIndex(null);
                              }}
                            >
                              <span className="action-icon">📌</span>
                              <span>Đặt làm ảnh chính</span>
                            </button>
                          )}
                          <button
                            type="button"
                            className="dropdown-action-btn delete-action"
                            onClick={() => {
                              handleRemoveImage(idx);
                              setMenuOpenIndex(null);
                            }}
                          >
                            <span className="action-icon">🗑️</span>
                            <span>Xóa ảnh này</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Card Thêm ảnh */}
                <button
                  type="button"
                  className="simple-add-card"
                  onClick={() => fileInputRef.current?.click()}
                  title="Nhấn để tải ảnh lên"
                >
                  <span className="add-plus-icon">+</span>
                  <span className="add-text">Thêm ảnh</span>
                </button>
              </div>
            </section>
          )}

          {/* STEP 5: MÔ TẢ */}
          {currentStep === 5 && (
            <section className="step-section">
              <h1 className="step-title">Tên & Giới thiệu Homestay</h1>
              <p className="step-desc">
                Đặt tên gây ấn tượng và mô tả những điểm quyến rũ nhất của chỗ nghỉ.
              </p>

              <div className="wizard-form-card">
                <div className="field-group">
                  <label>Tên Homestay <span className="req">*</span></label>
                  <input
                    type="text"
                    name="homestayName"
                    value={formData.homestayName}
                    onChange={handleChange}
                    placeholder="VD: The Dalat Cloud View Villa & Stay"
                    required
                  />
                </div>

                <div className="field-group">
                  <label>Mô tả chi tiết</label>
                  <textarea
                    rows="5"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Giới thiệu không gian, phong cảnh xung quanh, khoảng cách tới trung tâm và cảm giác đón tiếp..."
                  />
                </div>
              </div>
            </section>
          )}

          {/* STEP 6: CHÍNH SÁCH */}
          {currentStep === 6 && (
            <section className="step-section">
              <h1 className="step-title">Chính sách & Quy định homestay</h1>
              <p className="step-desc">
                Thiết lập khung giờ đón khách, tỷ lệ đặt cọc và nội quy lưu trú theo chuẩn quy định của Host.
              </p>

              <div className="wizard-form-card">
                {/* 1. Nhận & Trả phòng */}
                <div className="policy-group-heading">
                  <span className="policy-group-icon">⏰</span>
                  <div>
                    <h3>1. Thời gian Nhận phòng & Trả phòng</h3>
                    <p>Khung giờ quy chuẩn để chuẩn bị và dọn dẹp buồng phòng sạch sẽ đón khách.</p>
                  </div>
                </div>

                <div className="field-row">
                  <div className="field-group">
                    <label>Giờ nhận phòng chuẩn (Check-in) <span className="req">*</span></label>
                    <input
                      type="time"
                      name="checkInTime"
                      value={formData.checkInTime}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="field-group">
                    <label>Giờ trả phòng chuẩn (Check-out) <span className="req">*</span></label>
                    <input
                      type="time"
                      name="checkOutTime"
                      value={formData.checkOutTime}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="policy-notice-box">
                  <span className="notice-icon">ℹ️</span>
                  <div>
                    <strong>Quy định nhận phòng sớm & trả phòng trễ (theo chính sách hệ thống):</strong>
                    <ul>
                      <li>Nhận phòng sớm: 10:00 - 14:00 (Miễn phí nếu có sẵn phòng) · 06:00 - 10:00 (+50% giá phòng) · Trước 06:00 (+100%).</li>
                      <li>Trả phòng trễ: 12:00 - 15:00 (+30% giá phòng) · 15:00 - 18:00 (+50%) · Sau 18:00 (+100%).</li>
                    </ul>
                  </div>
                </div>

                {/* 2. Đặt cọc & Hủy phòng */}
                <div className="policy-group-heading" style={{ marginTop: '24px' }}>
                  <span className="policy-group-icon">💳</span>
                  <div>
                    <h3>2. Chính sách Đặt cọc & Hủy phòng</h3>
                    <p>Mức đặt cọc giữ chỗ và quy tắc hoàn tiền khi khách hủy chuyến.</p>
                  </div>
                </div>

                <div className="field-row">
                  <div className="field-group">
                    <label>Tiền cọc thông thường (%) <span className="req">*</span></label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      name="standardDepositPercent"
                      value={formData.standardDepositPercent}
                      onChange={handleChange}
                      placeholder="30"
                      required
                    />
                  </div>
                  <div className="field-group">
                    <label>Tiền cọc mùa Lễ / Tết (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      name="holidayDepositPercent"
                      value={formData.holidayDepositPercent}
                      onChange={handleChange}
                      placeholder="50"
                    />
                  </div>
                </div>

                <div className="cancellation-policy-summary">
                  <div className="summary-title">🛡️ Khung hoàn cọc khi khách hủy phòng:</div>
                  <div className="cancel-tiers-list">
                    <div className="cancel-tier-item tier-green">
                      <span className="tier-days">Trước 7 ngày</span>
                      <span className="tier-refund">Hoàn 100% cọc</span>
                    </div>
                    <div className="cancel-tier-item tier-amber">
                      <span className="tier-days">Từ 3 – 7 ngày</span>
                      <span className="tier-refund">Hoàn 50% cọc</span>
                    </div>
                    <div className="cancel-tier-item tier-red">
                      <span className="tier-days">Dưới 3 ngày</span>
                      <span className="tier-refund">Không hoàn cọc (0%)</span>
                    </div>
                  </div>
                </div>

                {/* 3. Nội quy lưu trú */}
                <div className="policy-group-heading" style={{ marginTop: '24px' }}>
                  <span className="policy-group-icon">📋</span>
                  <div>
                    <h3>3. Nội quy lưu trú</h3>
                    <p>Các quy định đảm bảo an toàn, yên tĩnh và không gian chung cho homestay.</p>
                  </div>
                </div>

                {/* Checkbox Thú cưng */}
                <div className="policy-card-option">
                  <label className="checkbox-label-block">
                    <input
                      type="checkbox"
                      name="allowPets"
                      checked={formData.allowPets}
                      onChange={handleChange}
                    />
                    <div className="checkbox-text">
                      <strong>Cho phép mang theo thú cưng 🐾</strong>
                      <span>Khách được mang theo vật nuôi nếu đồng ý với nội quy và phụ phí vệ sinh</span>
                    </div>
                  </label>

                  {formData.allowPets && (
                    <div className="field-row sub-options-row" style={{ marginTop: '12px' }}>
                      <div className="field-group">
                        <label>Phụ phí thú cưng (VNĐ / đêm)</label>
                        <input
                          type="number"
                          name="petFeePerNight"
                          value={formData.petFeePerNight}
                          onChange={handleChange}
                          placeholder="150000"
                        />
                      </div>
                      <div className="field-group">
                        <label>Số thú cưng tối đa / phòng</label>
                        <input
                          type="number"
                          min="1"
                          max="5"
                          name="maxPetsPerRoom"
                          value={formData.maxPetsPerRoom}
                          onChange={handleChange}
                          placeholder="1"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Checkbox Hút thuốc */}
                <div className="policy-card-option">
                  <label className="checkbox-label-block">
                    <input
                      type="checkbox"
                      name="smokingAllowed"
                      checked={formData.smokingAllowed}
                      onChange={handleChange}
                    />
                    <div className="checkbox-text">
                      <strong>Cho phép hút thuốc trong phòng 🚬</strong>
                      <span>Nếu không chọn: Nghiêm cấm hút thuốc lá/thuốc lá điện tử trong toàn bộ buồng phòng</span>
                    </div>
                  </label>
                </div>

                {/* Checkbox Tổ chức tiệc */}
                <div className="policy-card-option">
                  <label className="checkbox-label-block">
                    <input
                      type="checkbox"
                      name="partiesRequireApproval"
                      checked={formData.partiesRequireApproval}
                      onChange={handleChange}
                    />
                    <div className="checkbox-text">
                      <strong>Tổ chức tiệc & sự kiện cần Host duyệt trước 🎉</strong>
                      <span>Tránh tụ tập đông người gây mất trật tự hoặc ảnh hưởng đến các phòng lân cận</span>
                    </div>
                  </label>
                </div>

                {/* Giờ yên tĩnh */}
                <div className="field-row" style={{ marginTop: '12px' }}>
                  <div className="field-group">
                    <label>Giờ giữ yên tĩnh từ 🤫</label>
                    <input
                      type="time"
                      name="quietHoursFrom"
                      value={formData.quietHoursFrom}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="field-group">
                    <label>Đến sáng hôm sau</label>
                    <input
                      type="time"
                      name="quietHoursTo"
                      value={formData.quietHoursTo}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* STEP 7: CHỦ NHÀ */}
          {currentStep === 7 && (
            <section className="step-section">
              <h1 className="step-title">Thông tin Chủ nhà & Nhận tiền</h1>
              <p className="step-desc">
                Xác minh thông tin đối tác và tài khoản ngân hàng để Tripio chuyển tiền thanh toán cho bạn.
              </p>

              <div className="wizard-form-card">
                <div className="field-row">
                  <div className="field-group">
                    <label>Số điện thoại liên hệ <span className="req">*</span></label>
                    <input
                      type="tel"
                      name="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={handleChange}
                      placeholder="0912345678"
                      required
                    />
                  </div>
                  <div className="field-group">
                    <label>Số CCCD / Hộ chiếu <span className="req">*</span></label>
                    <input
                      type="text"
                      name="idCardNumber"
                      value={formData.idCardNumber}
                      onChange={handleChange}
                      placeholder="079201009999"
                      required
                    />
                  </div>
                </div>

                <div className="field-group">
                  <label>Ngân hàng nhận doanh thu <span className="req">*</span></label>
                  <select
                    name="bankName"
                    value={formData.bankName}
                    onChange={handleChange}
                  >
                    {popularBanks.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div className="field-row">
                  <div className="field-group">
                    <label>Số tài khoản ngân hàng <span className="req">*</span></label>
                    <input
                      type="text"
                      name="bankAccountNumber"
                      value={formData.bankAccountNumber}
                      onChange={handleChange}
                      placeholder="VD: 10123456789"
                      required
                    />
                  </div>
                  <div className="field-group">
                    <label>Tên chủ tài khoản (In hoa) <span className="req">*</span></label>
                    <input
                      type="text"
                      name="bankAccountName"
                      value={formData.bankAccountName}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          bankAccountName: e.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="VD: NGUYEN VAN A"
                      required
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* STEP 8: HOÀN TẤT */}
          {currentStep === 8 && (
            <section className="step-section">
              <h1 className="step-title">Xác nhận & Gửi đăng ký</h1>
              <p className="step-desc">
                Xem lại thông tin chỗ nghỉ của bạn trước khi gửi ban quản trị phê duyệt.
              </p>

              <div className="wizard-summary-card">
                <div className="summary-row">
                  <span>Tên chỗ nghỉ:</span>
                  <strong>{formData.homestayName || '(Chưa đặt tên)'}</strong>
                </div>
                <div className="summary-row">
                  <span>Vị trí:</span>
                  <strong>{formData.addressLine}, {formData.ward}, {formData.district}, {formData.province}</strong>
                </div>
                <div className="summary-row">
                  <span>Loại phòng:</span>
                  <strong>{formData.roomTypeName} ({new Intl.NumberFormat('vi-VN').format(formData.roomBasePrice)} đ / đêm)</strong>
                </div>
                <div className="summary-row">
                  <span>Hình ảnh đã tải lên:</span>
                  <strong>{formData.images?.length || 0} ảnh</strong>
                </div>
                <div className="summary-row">
                  <span>Giờ nhận / trả phòng:</span>
                  <strong>{formData.checkInTime} / {formData.checkOutTime}</strong>
                </div>
                <div className="summary-row">
                  <span>Chính sách đặt cọc:</span>
                  <strong>Cọc chuẩn {formData.standardDepositPercent}% · Lễ/Tết {formData.holidayDepositPercent}%</strong>
                </div>
                <div className="summary-row">
                  <span>Nội quy:</span>
                  <strong>
                    {formData.allowPets ? `Cho phép thú cưng (${Number(formData.petFeePerNight).toLocaleString('vi-VN')} đ/đêm)` : 'Không mang thú cưng'} · {formData.smokingAllowed ? 'Cho phép hút thuốc' : 'Cấm hút thuốc trong phòng'} · Yên tĩnh ({formData.quietHoursFrom} - {formData.quietHoursTo})
                  </strong>
                </div>
                <div className="summary-row">
                  <span>Chủ sở hữu:</span>
                  <strong>{user?.fullName} · {formData.phoneNumber}</strong>
                </div>
                <div className="summary-row">
                  <span>Tài khoản nhận tiền:</span>
                  <strong>{formData.bankName} - {formData.bankAccountNumber} ({formData.bankAccountName})</strong>
                </div>
              </div>
            </section>
          )}

          {/* Action Bottom Bar */}
          <div className="wizard-bottom-bar">
            <button
              type="button"
              className="btn-back"
              onClick={handlePrev}
              disabled={submitting}
            >
              {currentStep === 1 ? '✕ Hủy bỏ' : '← Quay lại'}
            </button>

            {currentStep < 8 ? (
              <button
                type="button"
                className="btn-next"
                onClick={handleNext}
              >
                Tiếp theo →
              </button>
            ) : (
              <button
                type="button"
                className="btn-submit"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Đang gửi hồ sơ...' : '✓ Hoàn tất & Gửi đăng ký'}
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
