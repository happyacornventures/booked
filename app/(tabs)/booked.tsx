import * as Calendar from 'expo-calendar';
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

export default function CalendarList() {
  const [calendars, setCalendars] = useState<Calendar.Calendar[]>([]);

  useEffect(() => {
    (async () => {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status === 'granted') {
        const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        setCalendars(cals);
      } else {
        console.warn('Calendar permission not granted');
      }
    })();
  }, []);

  return (
    <ScrollView>
      <Text style={{ fontSize: 24, margin: 10 }}>Available Calendars:</Text>
      {calendars.map((cal) => (
        <View key={cal.id} style={{ margin: 10 }}>
          <Text>Name: {cal.title}</Text>
          <Text>Source: {cal.source.name}</Text>
          <Text>Type: {cal.source.type}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
