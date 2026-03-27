import React, { useCallback, useMemo, useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import DateTimePickerModal from 'react-native-modal-datetime-picker'
import { AppFonts } from '../AppFonts'
import { ImageAssets } from '../ImageAssets'

type AppDatePickerFieldProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maximumDate?: Date
  minimumDate?: Date
}

const formatPickerDate = (date: Date) => {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

const parsePickerDate = (value?: string) => {
  if (!value) return new Date()
  const match = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return new Date()
  const day = Number(match[1])
  const month = Number(match[2]) - 1
  const year = Number(match[3])
  const parsed = new Date(year, month, day)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

export const AppDatePickerField = ({
  value,
  onChange,
  placeholder = 'Select date',
  maximumDate,
  minimumDate,
}: AppDatePickerFieldProps) => {
  const [visible, setVisible] = useState(false)
  const pickerDate = useMemo(() => parsePickerDate(value), [value])

  const open = useCallback(() => setVisible(true), [])
  const close = useCallback(() => setVisible(false), [])

  const onConfirm = useCallback(
    (date: Date) => {
      onChange(formatPickerDate(date))
      close()
    },
    [close, onChange],
  )

  return (
    <>
      <Pressable style={styles.input} onPress={open} accessibilityRole="button">
        <Text style={value ? styles.inputText : styles.inputPlaceholder}>{value || placeholder}</Text>
        <View style={styles.iconWrap}>
          <Image source={ImageAssets.calendar} style={styles.icon} resizeMode="contain" />
        </View>
      </Pressable>
      <DateTimePickerModal
        isVisible={visible}
        mode="date"
        date={pickerDate}
        onConfirm={onConfirm}
        onCancel={close}
        maximumDate={maximumDate}
        minimumDate={minimumDate}
        isDarkModeEnabled
        accentColor="#F97A31"
        buttonTextColorIOS="#F97A31"
        display="spinner"
      />
    </>
  )
}

const styles = StyleSheet.create({
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#314157',
    backgroundColor: '#1a2433',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  inputText: {
    color: '#fff',
    fontFamily: AppFonts.montserratMedium,
    fontSize: 14,
    flex: 1,
  },
  inputPlaceholder: {
    color: '#a2b0c5',
    fontFamily: AppFonts.montserratMedium,
    fontSize: 14,
    flex: 1,
  },
  iconWrap: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 16,
    height: 16,
    tintColor: '#9FB0C9',
  },
})
