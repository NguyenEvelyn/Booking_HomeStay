/*
    Homestay Management Database - SQL Server
    Designed from db_homestay.docx

    Azure SQL Database version.
    Connect directly to the target database before running this script.
    It creates 18 tables, constraints, indexes and default roles.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* 1. Users */
CREATE TABLE dbo.Users
(
    user_id         BIGINT IDENTITY(1,1) NOT NULL,
    full_name       NVARCHAR(100) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    phone_number    VARCHAR(20) NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role             VARCHAR(20) NOT NULL
        CONSTRAINT DF_Users_Role DEFAULT ('Customer'),
    avatar_url      VARCHAR(500) NULL,
    date_of_birth   DATE NULL,
    gender          VARCHAR(20) NULL,
    status          VARCHAR(20) NOT NULL
        CONSTRAINT DF_Users_Status DEFAULT ('Unverified'),
    created_at      DATETIME2(0) NOT NULL
        CONSTRAINT DF_Users_CreatedAt DEFAULT (SYSUTCDATETIME()),
    updated_at      DATETIME2(0) NOT NULL
        CONSTRAINT DF_Users_UpdatedAt DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_Users PRIMARY KEY (user_id),
    CONSTRAINT UQ_Users_Email UNIQUE (email),
    CONSTRAINT CK_Users_Role CHECK (role IN ('Admin', 'Host', 'Customer')),
    CONSTRAINT CK_Users_Status CHECK (status IN ('Active', 'Locked', 'Unverified')),
    CONSTRAINT CK_Users_Gender CHECK
        (gender IS NULL OR gender IN ('Male', 'Female', 'Other')),
    CONSTRAINT CK_Users_DateOfBirth CHECK
        (date_of_birth IS NULL OR date_of_birth <= CAST(SYSUTCDATETIME() AS DATE))
);
GO

CREATE UNIQUE INDEX UX_Users_PhoneNumber
    ON dbo.Users(phone_number)
    WHERE phone_number IS NOT NULL;
GO

/* 2. Roles */
CREATE TABLE dbo.Roles
(
    role_id       INT IDENTITY(1,1) NOT NULL,
    role_name     VARCHAR(20) NOT NULL,
    description   NVARCHAR(255) NULL,
    created_at    DATETIME2(0) NOT NULL
        CONSTRAINT DF_Roles_CreatedAt DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_Roles PRIMARY KEY (role_id),
    CONSTRAINT UQ_Roles_RoleName UNIQUE (role_name),
    CONSTRAINT CK_Roles_RoleName CHECK (role_name IN ('Admin', 'Host', 'Customer'))
);
GO

/* 3. UserRoles */
CREATE TABLE dbo.UserRoles
(
    user_role_id   BIGINT IDENTITY(1,1) NOT NULL,
    user_id        BIGINT NOT NULL,
    role_id        INT NOT NULL,
    assigned_at    DATETIME2(0) NOT NULL
        CONSTRAINT DF_UserRoles_AssignedAt DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_UserRoles PRIMARY KEY (user_role_id),
    CONSTRAINT UQ_UserRoles_User_Role UNIQUE (user_id, role_id),
    CONSTRAINT FK_UserRoles_Users FOREIGN KEY (user_id)
        REFERENCES dbo.Users(user_id) ON DELETE CASCADE,
    CONSTRAINT FK_UserRoles_Roles FOREIGN KEY (role_id)
        REFERENCES dbo.Roles(role_id)
);
GO

/* 4. Homestays */
CREATE TABLE dbo.Homestays
(
    homestay_id     BIGINT IDENTITY(1,1) NOT NULL,
    host_id         BIGINT NOT NULL,
    name            NVARCHAR(200) NOT NULL,
    description     NVARCHAR(MAX) NOT NULL,
    address_line    NVARCHAR(255) NOT NULL,
    ward            NVARCHAR(100) NOT NULL,
    district        NVARCHAR(100) NOT NULL,
    province        NVARCHAR(100) NOT NULL,
    latitude        DECIMAL(10,7) NULL,
    longitude       DECIMAL(10,7) NULL,
    check_in_time   TIME(0) NOT NULL,
    check_out_time  TIME(0) NOT NULL,
    status          VARCHAR(30) NOT NULL
        CONSTRAINT DF_Homestays_Status DEFAULT ('Draft'),
    created_at      DATETIME2(0) NOT NULL
        CONSTRAINT DF_Homestays_CreatedAt DEFAULT (SYSUTCDATETIME()),
    updated_at      DATETIME2(0) NOT NULL
        CONSTRAINT DF_Homestays_UpdatedAt DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_Homestays PRIMARY KEY (homestay_id),
    CONSTRAINT FK_Homestays_Users FOREIGN KEY (host_id)
        REFERENCES dbo.Users(user_id),
    CONSTRAINT CK_Homestays_Latitude CHECK
        (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CONSTRAINT CK_Homestays_Longitude CHECK
        (longitude IS NULL OR longitude BETWEEN -180 AND 180),
    CONSTRAINT CK_Homestays_Status CHECK
        (status IN ('Draft', 'Pending', 'Approved', 'Rejected', 'Suspended'))
);
GO

/* 5. RoomTypes */
CREATE TABLE dbo.RoomTypes
(
    room_type_id   BIGINT IDENTITY(1,1) NOT NULL,
    homestay_id    BIGINT NOT NULL,
    name           NVARCHAR(150) NOT NULL,
    description    NVARCHAR(MAX) NOT NULL,
    base_price     DECIMAL(18,2) NOT NULL,
    max_adults     INT NOT NULL,
    max_children   INT NOT NULL,
    bed_type       NVARCHAR(100) NOT NULL,
    room_size      DECIMAL(8,2) NULL,
    status         VARCHAR(20) NOT NULL
        CONSTRAINT DF_RoomTypes_Status DEFAULT ('Active'),
    created_at     DATETIME2(0) NOT NULL
        CONSTRAINT DF_RoomTypes_CreatedAt DEFAULT (SYSUTCDATETIME()),
    updated_at     DATETIME2(0) NOT NULL
        CONSTRAINT DF_RoomTypes_UpdatedAt DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_RoomTypes PRIMARY KEY (room_type_id),
    CONSTRAINT UQ_RoomTypes_Homestay_Name UNIQUE (homestay_id, name),
    CONSTRAINT FK_RoomTypes_Homestays FOREIGN KEY (homestay_id)
        REFERENCES dbo.Homestays(homestay_id) ON DELETE CASCADE,
    CONSTRAINT CK_RoomTypes_BasePrice CHECK (base_price >= 0),
    CONSTRAINT CK_RoomTypes_MaxAdults CHECK (max_adults > 0),
    CONSTRAINT CK_RoomTypes_MaxChildren CHECK (max_children >= 0),
    CONSTRAINT CK_RoomTypes_RoomSize CHECK (room_size IS NULL OR room_size > 0),
    CONSTRAINT CK_RoomTypes_Status CHECK (status IN ('Active', 'Inactive'))
);
GO

/* 6. Rooms */
CREATE TABLE dbo.Rooms
(
    room_id         BIGINT IDENTITY(1,1) NOT NULL,
    room_type_id    BIGINT NOT NULL,
    room_number     NVARCHAR(30) NOT NULL,
    floor_number    INT NULL,
    status          VARCHAR(30) NOT NULL
        CONSTRAINT DF_Rooms_Status DEFAULT ('Available'),
    note            NVARCHAR(500) NULL,
    created_at      DATETIME2(0) NOT NULL
        CONSTRAINT DF_Rooms_CreatedAt DEFAULT (SYSUTCDATETIME()),
    updated_at      DATETIME2(0) NOT NULL
        CONSTRAINT DF_Rooms_UpdatedAt DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_Rooms PRIMARY KEY (room_id),
    CONSTRAINT UQ_Rooms_RoomType_Number UNIQUE (room_type_id, room_number),
    CONSTRAINT FK_Rooms_RoomTypes FOREIGN KEY (room_type_id)
        REFERENCES dbo.RoomTypes(room_type_id) ON DELETE CASCADE,
    CONSTRAINT CK_Rooms_Status CHECK
        (status IN ('Available', 'Occupied', 'Cleaning', 'Maintenance', 'Inactive'))
);
GO

/* 7. Amenities */
CREATE TABLE dbo.Amenities
(
    amenity_id    INT IDENTITY(1,1) NOT NULL,
    name          NVARCHAR(100) NOT NULL,
    icon_url      VARCHAR(500) NULL,
    category      NVARCHAR(50) NOT NULL,
    description   NVARCHAR(255) NULL,

    CONSTRAINT PK_Amenities PRIMARY KEY (amenity_id),
    CONSTRAINT UQ_Amenities_Name UNIQUE (name)
);
GO

/* 8. HomestayAmenities */
CREATE TABLE dbo.HomestayAmenities
(
    homestay_amenity_id   BIGINT IDENTITY(1,1) NOT NULL,
    homestay_id            BIGINT NOT NULL,
    amenity_id             INT NOT NULL,

    CONSTRAINT PK_HomestayAmenities PRIMARY KEY (homestay_amenity_id),
    CONSTRAINT UQ_HomestayAmenities UNIQUE (homestay_id, amenity_id),
    CONSTRAINT FK_HomestayAmenities_Homestays FOREIGN KEY (homestay_id)
        REFERENCES dbo.Homestays(homestay_id) ON DELETE CASCADE,
    CONSTRAINT FK_HomestayAmenities_Amenities FOREIGN KEY (amenity_id)
        REFERENCES dbo.Amenities(amenity_id) ON DELETE CASCADE
);
GO

/* 9. RoomTypeAmenities */
CREATE TABLE dbo.RoomTypeAmenities
(
    room_type_amenity_id   BIGINT IDENTITY(1,1) NOT NULL,
    room_type_id            BIGINT NOT NULL,
    amenity_id              INT NOT NULL,

    CONSTRAINT PK_RoomTypeAmenities PRIMARY KEY (room_type_amenity_id),
    CONSTRAINT UQ_RoomTypeAmenities UNIQUE (room_type_id, amenity_id),
    CONSTRAINT FK_RoomTypeAmenities_RoomTypes FOREIGN KEY (room_type_id)
        REFERENCES dbo.RoomTypes(room_type_id) ON DELETE CASCADE,
    CONSTRAINT FK_RoomTypeAmenities_Amenities FOREIGN KEY (amenity_id)
        REFERENCES dbo.Amenities(amenity_id) ON DELETE CASCADE
);
GO

/* 10. HomestayImages */
CREATE TABLE dbo.HomestayImages
(
    image_id       BIGINT IDENTITY(1,1) NOT NULL,
    homestay_id    BIGINT NOT NULL,
    image_url      VARCHAR(500) NOT NULL,
    caption        NVARCHAR(255) NULL,
    is_thumbnail   BIT NOT NULL
        CONSTRAINT DF_HomestayImages_IsThumbnail DEFAULT (0),
    sort_order     INT NOT NULL
        CONSTRAINT DF_HomestayImages_SortOrder DEFAULT (0),
    created_at     DATETIME2(0) NOT NULL
        CONSTRAINT DF_HomestayImages_CreatedAt DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_HomestayImages PRIMARY KEY (image_id),
    CONSTRAINT FK_HomestayImages_Homestays FOREIGN KEY (homestay_id)
        REFERENCES dbo.Homestays(homestay_id) ON DELETE CASCADE,
    CONSTRAINT CK_HomestayImages_SortOrder CHECK (sort_order >= 0)
);
GO

CREATE UNIQUE INDEX UX_HomestayImages_Thumbnail
    ON dbo.HomestayImages(homestay_id)
    WHERE is_thumbnail = 1;
GO

/* 11. RoomTypeImages */
CREATE TABLE dbo.RoomTypeImages
(
    image_id       BIGINT IDENTITY(1,1) NOT NULL,
    room_type_id   BIGINT NOT NULL,
    image_url      VARCHAR(500) NOT NULL,
    caption        NVARCHAR(255) NULL,
    is_thumbnail   BIT NOT NULL
        CONSTRAINT DF_RoomTypeImages_IsThumbnail DEFAULT (0),
    sort_order     INT NOT NULL
        CONSTRAINT DF_RoomTypeImages_SortOrder DEFAULT (0),
    created_at     DATETIME2(0) NOT NULL
        CONSTRAINT DF_RoomTypeImages_CreatedAt DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_RoomTypeImages PRIMARY KEY (image_id),
    CONSTRAINT FK_RoomTypeImages_RoomTypes FOREIGN KEY (room_type_id)
        REFERENCES dbo.RoomTypes(room_type_id) ON DELETE CASCADE,
    CONSTRAINT CK_RoomTypeImages_SortOrder CHECK (sort_order >= 0)
);
GO

CREATE UNIQUE INDEX UX_RoomTypeImages_Thumbnail
    ON dbo.RoomTypeImages(room_type_id)
    WHERE is_thumbnail = 1;
GO

/* 12. Bookings */
CREATE TABLE dbo.Bookings
(
    booking_id       BIGINT IDENTITY(1,1) NOT NULL,
    booking_code     VARCHAR(30) NOT NULL,
    customer_id      BIGINT NOT NULL,
    homestay_id      BIGINT NOT NULL,
    check_in_date    DATE NOT NULL,
    check_out_date   DATE NOT NULL,
    adult_count      INT NOT NULL,
    child_count      INT NOT NULL
        CONSTRAINT DF_Bookings_ChildCount DEFAULT (0),
    subtotal         DECIMAL(18,2) NOT NULL,
    discount_amount  DECIMAL(18,2) NOT NULL
        CONSTRAINT DF_Bookings_Discount DEFAULT (0),
    service_fee      DECIMAL(18,2) NOT NULL
        CONSTRAINT DF_Bookings_ServiceFee DEFAULT (0),
    tax_amount       DECIMAL(18,2) NOT NULL
        CONSTRAINT DF_Bookings_TaxAmount DEFAULT (0),
    total_amount     DECIMAL(18,2) NOT NULL,
    status           VARCHAR(30) NOT NULL
        CONSTRAINT DF_Bookings_Status DEFAULT ('PendingPayment'),
    customer_note    NVARCHAR(500) NULL,
    created_at       DATETIME2(0) NOT NULL
        CONSTRAINT DF_Bookings_CreatedAt DEFAULT (SYSUTCDATETIME()),
    updated_at       DATETIME2(0) NOT NULL
        CONSTRAINT DF_Bookings_UpdatedAt DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_Bookings PRIMARY KEY (booking_id),
    CONSTRAINT UQ_Bookings_BookingCode UNIQUE (booking_code),
    CONSTRAINT FK_Bookings_Customers FOREIGN KEY (customer_id)
        REFERENCES dbo.Users(user_id),
    CONSTRAINT FK_Bookings_Homestays FOREIGN KEY (homestay_id)
        REFERENCES dbo.Homestays(homestay_id),
    CONSTRAINT CK_Bookings_Dates CHECK (check_out_date > check_in_date),
    CONSTRAINT CK_Bookings_AdultCount CHECK (adult_count > 0),
    CONSTRAINT CK_Bookings_ChildCount CHECK (child_count >= 0),
    CONSTRAINT CK_Bookings_Amounts CHECK
        (subtotal >= 0 AND discount_amount >= 0 AND service_fee >= 0
         AND tax_amount >= 0 AND total_amount >= 0),
    CONSTRAINT CK_Bookings_TotalAmount CHECK
        (total_amount = subtotal - discount_amount + service_fee + tax_amount),
    CONSTRAINT CK_Bookings_Status CHECK
        (status IN ('PendingPayment', 'Confirmed', 'CheckedIn', 'Completed',
                    'Cancelled', 'NoShow'))
);
GO

/* 13. BookingDetails: one row represents one physical room (quantity = 1). */
CREATE TABLE dbo.BookingDetails
(
    booking_detail_id  BIGINT IDENTITY(1,1) NOT NULL,
    booking_id         BIGINT NOT NULL,
    room_type_id       BIGINT NOT NULL,
    room_id            BIGINT NULL,
    quantity           INT NOT NULL
        CONSTRAINT DF_BookingDetails_Quantity DEFAULT (1),
    price_per_night    DECIMAL(18,2) NOT NULL,
    number_of_nights   INT NOT NULL,
    extra_fee          DECIMAL(18,2) NOT NULL
        CONSTRAINT DF_BookingDetails_ExtraFee DEFAULT (0),
    line_total         DECIMAL(18,2) NOT NULL,
    guest_name         NVARCHAR(100) NULL,
    note               NVARCHAR(500) NULL,

    CONSTRAINT PK_BookingDetails PRIMARY KEY (booking_detail_id),
    CONSTRAINT FK_BookingDetails_Bookings FOREIGN KEY (booking_id)
        REFERENCES dbo.Bookings(booking_id) ON DELETE CASCADE,
    CONSTRAINT FK_BookingDetails_RoomTypes FOREIGN KEY (room_type_id)
        REFERENCES dbo.RoomTypes(room_type_id),
    CONSTRAINT FK_BookingDetails_Rooms FOREIGN KEY (room_id)
        REFERENCES dbo.Rooms(room_id),
    CONSTRAINT CK_BookingDetails_Quantity CHECK (quantity = 1),
    CONSTRAINT CK_BookingDetails_Price CHECK (price_per_night >= 0),
    CONSTRAINT CK_BookingDetails_Nights CHECK (number_of_nights > 0),
    CONSTRAINT CK_BookingDetails_ExtraFee CHECK (extra_fee >= 0),
    CONSTRAINT CK_BookingDetails_LineTotal CHECK
        (line_total = price_per_night * number_of_nights + extra_fee)
);
GO

/* 14. CheckInOuts */
CREATE TABLE dbo.CheckInOuts
(
    check_in_out_id          BIGINT IDENTITY(1,1) NOT NULL,
    booking_id               BIGINT NOT NULL,
    checked_in_by            BIGINT NULL,
    actual_check_in_at       DATETIME2(0) NULL,
    checked_out_by           BIGINT NULL,
    actual_check_out_at      DATETIME2(0) NULL,
    guest_identity_number    VARCHAR(30) NULL,
    deposit_amount           DECIMAL(18,2) NOT NULL
        CONSTRAINT DF_CheckInOuts_Deposit DEFAULT (0),
    additional_charge        DECIMAL(18,2) NOT NULL
        CONSTRAINT DF_CheckInOuts_AdditionalCharge DEFAULT (0),
    note                     NVARCHAR(500) NULL,
    status                   VARCHAR(20) NOT NULL
        CONSTRAINT DF_CheckInOuts_Status DEFAULT ('NotCheckedIn'),

    CONSTRAINT PK_CheckInOuts PRIMARY KEY (check_in_out_id),
    CONSTRAINT UQ_CheckInOuts_Booking UNIQUE (booking_id),
    CONSTRAINT FK_CheckInOuts_Bookings FOREIGN KEY (booking_id)
        REFERENCES dbo.Bookings(booking_id) ON DELETE CASCADE,
    CONSTRAINT FK_CheckInOuts_CheckedInBy FOREIGN KEY (checked_in_by)
        REFERENCES dbo.Users(user_id),
    CONSTRAINT FK_CheckInOuts_CheckedOutBy FOREIGN KEY (checked_out_by)
        REFERENCES dbo.Users(user_id),
    CONSTRAINT CK_CheckInOuts_Times CHECK
        (actual_check_out_at IS NULL OR actual_check_in_at IS NULL
         OR actual_check_out_at >= actual_check_in_at),
    CONSTRAINT CK_CheckInOuts_Amounts CHECK
        (deposit_amount >= 0 AND additional_charge >= 0),
    CONSTRAINT CK_CheckInOuts_Status CHECK
        (status IN ('NotCheckedIn', 'CheckedIn', 'CheckedOut'))
);
GO

/* 15. Cancellations */
CREATE TABLE dbo.Cancellations
(
    cancellation_id   BIGINT IDENTITY(1,1) NOT NULL,
    booking_id         BIGINT NOT NULL,
    cancelled_by       BIGINT NOT NULL,
    reason             NVARCHAR(500) NOT NULL,
    cancelled_at       DATETIME2(0) NOT NULL
        CONSTRAINT DF_Cancellations_CancelledAt DEFAULT (SYSUTCDATETIME()),
    cancellation_fee   DECIMAL(18,2) NOT NULL
        CONSTRAINT DF_Cancellations_Fee DEFAULT (0),
    refund_amount      DECIMAL(18,2) NOT NULL
        CONSTRAINT DF_Cancellations_Refund DEFAULT (0),
    status             VARCHAR(30) NOT NULL
        CONSTRAINT DF_Cancellations_Status DEFAULT ('Requested'),
    processed_by       BIGINT NULL,
    processed_at       DATETIME2(0) NULL,

    CONSTRAINT PK_Cancellations PRIMARY KEY (cancellation_id),
    CONSTRAINT FK_Cancellations_Bookings FOREIGN KEY (booking_id)
        REFERENCES dbo.Bookings(booking_id),
    CONSTRAINT FK_Cancellations_CancelledBy FOREIGN KEY (cancelled_by)
        REFERENCES dbo.Users(user_id),
    CONSTRAINT FK_Cancellations_ProcessedBy FOREIGN KEY (processed_by)
        REFERENCES dbo.Users(user_id),
    CONSTRAINT CK_Cancellations_Amounts CHECK
        (cancellation_fee >= 0 AND refund_amount >= 0),
    CONSTRAINT CK_Cancellations_Status CHECK
        (status IN ('Requested', 'Approved', 'Rejected', 'Refunded')),
    CONSTRAINT CK_Cancellations_Processing CHECK
        ((processed_at IS NULL AND processed_by IS NULL)
         OR (processed_at IS NOT NULL AND processed_by IS NOT NULL))
);
GO

/* 16. Payments */
CREATE TABLE dbo.Payments
(
    payment_id         BIGINT IDENTITY(1,1) NOT NULL,
    booking_id         BIGINT NOT NULL,
    transaction_code   VARCHAR(100) NOT NULL,
    payment_method     VARCHAR(30) NOT NULL,
    transaction_type   VARCHAR(20) NOT NULL,
    amount             DECIMAL(18,2) NOT NULL,
    status             VARCHAR(30) NOT NULL
        CONSTRAINT DF_Payments_Status DEFAULT ('Pending'),
    paid_at            DATETIME2(0) NULL,
    gateway_response   NVARCHAR(MAX) NULL,
    created_at         DATETIME2(0) NOT NULL
        CONSTRAINT DF_Payments_CreatedAt DEFAULT (SYSUTCDATETIME()),
    updated_at         DATETIME2(0) NOT NULL
        CONSTRAINT DF_Payments_UpdatedAt DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_Payments PRIMARY KEY (payment_id),
    CONSTRAINT UQ_Payments_TransactionCode UNIQUE (transaction_code),
    CONSTRAINT FK_Payments_Bookings FOREIGN KEY (booking_id)
        REFERENCES dbo.Bookings(booking_id),
    CONSTRAINT CK_Payments_Method CHECK
        (payment_method IN ('Cash', 'BankTransfer', 'VNPay', 'MoMo')),
    CONSTRAINT CK_Payments_Type CHECK
        (transaction_type IN ('Payment', 'Refund')),
    CONSTRAINT CK_Payments_Amount CHECK (amount > 0),
    CONSTRAINT CK_Payments_Status CHECK
        (status IN ('Pending', 'Success', 'Failed', 'Cancelled')),
    CONSTRAINT CK_Payments_PaidAt CHECK
        (status <> 'Success' OR paid_at IS NOT NULL)
);
GO

/* 17. Invoices */
CREATE TABLE dbo.Invoices
(
    invoice_id        BIGINT IDENTITY(1,1) NOT NULL,
    invoice_number    VARCHAR(30) NOT NULL,
    booking_id        BIGINT NOT NULL,
    customer_name     NVARCHAR(100) NOT NULL,
    customer_email    VARCHAR(255) NULL,
    customer_address  NVARCHAR(255) NULL,
    tax_code          VARCHAR(30) NULL,
    subtotal          DECIMAL(18,2) NOT NULL,
    tax_amount        DECIMAL(18,2) NOT NULL,
    total_amount      DECIMAL(18,2) NOT NULL,
    issued_at         DATETIME2(0) NOT NULL
        CONSTRAINT DF_Invoices_IssuedAt DEFAULT (SYSUTCDATETIME()),
    status            VARCHAR(20) NOT NULL
        CONSTRAINT DF_Invoices_Status DEFAULT ('Issued'),
    invoice_file_url  VARCHAR(500) NULL,

    CONSTRAINT PK_Invoices PRIMARY KEY (invoice_id),
    CONSTRAINT UQ_Invoices_Number UNIQUE (invoice_number),
    CONSTRAINT FK_Invoices_Bookings FOREIGN KEY (booking_id)
        REFERENCES dbo.Bookings(booking_id),
    CONSTRAINT CK_Invoices_Amounts CHECK
        (subtotal >= 0 AND tax_amount >= 0 AND total_amount = subtotal + tax_amount),
    CONSTRAINT CK_Invoices_Status CHECK
        (status IN ('Issued', 'Cancelled', 'Adjusted'))
);
GO

/* 18. Reviews */
CREATE TABLE dbo.Reviews
(
    review_id         BIGINT IDENTITY(1,1) NOT NULL,
    booking_id        BIGINT NOT NULL,
    customer_id       BIGINT NOT NULL,
    homestay_id       BIGINT NOT NULL,
    rating            INT NOT NULL,
    comment           NVARCHAR(2000) NULL,
    host_reply        NVARCHAR(2000) NULL,
    host_replied_at   DATETIME2(0) NULL,
    status            VARCHAR(20) NOT NULL
        CONSTRAINT DF_Reviews_Status DEFAULT ('Visible'),
    created_at        DATETIME2(0) NOT NULL
        CONSTRAINT DF_Reviews_CreatedAt DEFAULT (SYSUTCDATETIME()),
    updated_at        DATETIME2(0) NOT NULL
        CONSTRAINT DF_Reviews_UpdatedAt DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_Reviews PRIMARY KEY (review_id),
    CONSTRAINT UQ_Reviews_Booking UNIQUE (booking_id),
    CONSTRAINT FK_Reviews_Bookings FOREIGN KEY (booking_id)
        REFERENCES dbo.Bookings(booking_id),
    CONSTRAINT FK_Reviews_Customers FOREIGN KEY (customer_id)
        REFERENCES dbo.Users(user_id),
    CONSTRAINT FK_Reviews_Homestays FOREIGN KEY (homestay_id)
        REFERENCES dbo.Homestays(homestay_id),
    CONSTRAINT CK_Reviews_Rating CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT CK_Reviews_Status CHECK
        (status IN ('Visible', 'Hidden', 'Reported')),
    CONSTRAINT CK_Reviews_HostReply CHECK
        ((host_reply IS NULL AND host_replied_at IS NULL)
         OR (host_reply IS NOT NULL AND host_replied_at IS NOT NULL))
);
GO

/* Supporting indexes for common searches and foreign-key joins. */
CREATE INDEX IX_UserRoles_RoleId ON dbo.UserRoles(role_id);
CREATE INDEX IX_Homestays_Host_Status ON dbo.Homestays(host_id, status);
CREATE INDEX IX_Homestays_Location_Status
    ON dbo.Homestays(province, district, status);
CREATE INDEX IX_RoomTypes_Homestay_Status ON dbo.RoomTypes(homestay_id, status);
CREATE INDEX IX_Bookings_Customer_CreatedAt
    ON dbo.Bookings(customer_id, created_at DESC);
CREATE INDEX IX_Bookings_Homestay_Dates_Status
    ON dbo.Bookings(homestay_id, check_in_date, check_out_date, status);
CREATE INDEX IX_BookingDetails_BookingId ON dbo.BookingDetails(booking_id);
CREATE INDEX IX_BookingDetails_RoomId ON dbo.BookingDetails(room_id)
    WHERE room_id IS NOT NULL;
CREATE INDEX IX_Cancellations_BookingId ON dbo.Cancellations(booking_id);
CREATE INDEX IX_Payments_Booking_Status ON dbo.Payments(booking_id, status);
CREATE INDEX IX_Invoices_BookingId ON dbo.Invoices(booking_id);
CREATE INDEX IX_Reviews_Homestay_Status_CreatedAt
    ON dbo.Reviews(homestay_id, status, created_at DESC);
GO

/* Default authorization roles. */
INSERT INTO dbo.Roles (role_name, description)
VALUES
    ('Admin', N'Quản trị hệ thống'),
    ('Host', N'Chủ homestay'),
    ('Customer', N'Khách đặt phòng');
GO

/*
    Important rules that should also be checked in the service layer:
    - A Homestays.host_id must identify a Host.
    - Booking room dates must not overlap another active booking for that room.
    - BookingDetails.room_id must belong to BookingDetails.room_type_id.
    - A Review can only be created for its booking customer after Completed status.
    - Keep Users.role synchronized with UserRoles when multi-role access is used.
*/





